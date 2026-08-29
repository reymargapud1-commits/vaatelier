import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, payments, liveSessionBookings, storeOrders, courses } from "@/db/schema";
import { verifyPaymongoWebhookSignature } from "@/lib/paymongo";
import { markPaymentPaid } from "@/lib/payment-fulfillment";
import { sendWelcomeEmail } from "@/lib/notify";

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

      if (payment) {
        // markPaymentPaid reads purpose/referenceId off the payments row
        // itself and applies the matching side effect (enrollment / coaching
        // / store_order) - see lib/payment-fulfillment.ts. Shared with the
        // manual-GCash admin-approval path so "what happens when a payment
        // is confirmed" isn't duplicated in two places.
        await markPaymentPaid(payment.id);
      } else if (userIdFromMetadata) {
        // No payments row found (shouldn't normally happen) - fall back to
        // the metadata PayMongo echoes back, same as the pre-refactor logic.
        await db.update(users).set({ isPaid: true, paidAt: new Date() }).where(eq(users.id, userIdFromMetadata));

        const [student] = await db.select().from(users).where(eq(users.id, userIdFromMetadata)).limit(1);
        const [course] = await db.select().from(courses).limit(1);
        if (student) {
          await sendWelcomeEmail({
            studentName: student.name,
            studentEmail: student.email,
            courseTitle: course?.title || "The VA Atelier Training Program",
          });
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
