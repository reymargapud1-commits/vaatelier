import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, payments, liveSessionBookings, storeOrders, courses } from "@/db/schema";
import { verifyPaymongoWebhookSignature } from "@/lib/paymongo";
import { notifyCoachOfBooking, notifyCoachOfOrder } from "@/lib/notify";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("paymongo-signature");
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("PAYMONGO_WEBHOOK_SECRET is not set - rejecting webhook.");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const isLive = (process.env.PAYMONGO_SECRET_KEY || "").startsWith("sk_live_");
  const validSignature = verifyPaymongoWebhookSignature(
    rawBody,
    signatureHeader,
    webhookSecret,
    isLive
  );

  if (!validSignature) {
    console.warn("Invalid PayMongo webhook signature received.");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = event?.data?.attributes?.type;
  const eventData = event?.data?.attributes?.data;

  console.log("PayMongo webhook received:", eventType);

  // checkout_session.payment.paid fires when a checkout session is paid in full.
  if (eventType === "checkout_session.payment.paid") {
    const checkoutSessionId = eventData?.id;
    const metadata = eventData?.attributes?.metadata || {};
    const userIdFromMetadata = metadata?.userId;

    if (checkoutSessionId) {
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.checkoutSessionId, checkoutSessionId))
        .limit(1);

      const purpose = payment?.purpose || metadata?.purpose || "enrollment";
      const referenceId = payment?.referenceId || metadata?.referenceId || null;

      if (payment) {
        await db.update(payments).set({ status: "paid" }).where(eq(payments.id, payment.id));
      }

      if (purpose === "coaching" && referenceId) {
        await db
          .update(liveSessionBookings)
          .set({ paymentStatus: "paid" })
          .where(eq(liveSessionBookings.id, referenceId));

        const [booking] = await db
          .select()
          .from(liveSessionBookings)
          .where(eq(liveSessionBookings.id, referenceId))
          .limit(1);
        if (booking) {
          const [student] = await db.select().from(users).where(eq(users.id, booking.userId)).limit(1);
          const [course] = await db.select().from(courses).where(eq(courses.id, booking.courseId)).limit(1);
          if (student && course) {
            const coachName = course.coachName || process.env.COACH_NAME || "Reymar Gapud";
            await notifyCoachOfBooking({
              bookingId: booking.id,
              studentName: student.name,
              studentEmail: student.email,
              coachName,
              scheduledAt: booking.scheduledAt,
              note: booking.studentNote,
              courseTitle: course.title,
            });
          }
        }
      } else if (purpose === "store_order" && referenceId) {
        await db.update(storeOrders).set({ status: "paid" }).where(eq(storeOrders.id, referenceId));

        const [order] = await db.select().from(storeOrders).where(eq(storeOrders.id, referenceId)).limit(1);
        if (order) {
          const [student] = await db.select().from(users).where(eq(users.id, order.userId)).limit(1);
          if (student) {
            await notifyCoachOfOrder({
              orderId: order.id,
              studentName: student.name,
              studentEmail: student.email,
              itemLabel: order.itemLabel,
              amountCentavos: order.amountCentavos,
              note: order.customerNote,
            });
          }
        }
      } else {
        // Default / legacy path: course enrollment.
        const userId = payment?.userId || userIdFromMetadata;
        if (userId) {
          await db.update(users).set({ isPaid: true, paidAt: new Date() }).where(eq(users.id, userId));
        }
      }
    }
  }

  // payment.failed - mark the relevant row so support can investigate.
  if (eventType === "payment.failed") {
    const checkoutSessionId = eventData?.attributes?.checkout_session_id;
    if (checkoutSessionId) {
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.checkoutSessionId, checkoutSessionId))
        .limit(1);

      await db.update(payments).set({ status: "failed" }).where(eq(payments.checkoutSessionId, checkoutSessionId));

      if (payment?.purpose === "coaching" && payment.referenceId) {
        await db
          .update(liveSessionBookings)
          .set({ paymentStatus: "unpaid" })
          .where(eq(liveSessionBookings.id, payment.referenceId));
      } else if (payment?.purpose === "store_order" && payment.referenceId) {
        await db
          .update(storeOrders)
          .set({ status: "cancelled" })
          .where(eq(storeOrders.id, payment.referenceId));
      }
    }
  }

  return NextResponse.json({ received: true });
}
