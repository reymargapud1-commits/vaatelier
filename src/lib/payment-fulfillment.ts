import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, payments, liveSessionBookings, storeOrders, courses } from "@/db/schema";
import { notifyCoachOfBooking, notifyCoachOfOrder, sendWelcomeEmail } from "@/lib/notify";

/**
 * Applies the side effect of a payment being confirmed paid - shared by
 * BOTH the PayMongo webhook (api/payment/webhook) and the manual-GCash
 * admin approval action (api/admin/manual-payments/[id]/approve), so
 * "what happens when a payment is confirmed" lives in exactly one place
 * regardless of which path confirmed it.
 *
 * Idempotent: calling this twice on an already-paid payment is a no-op, so
 * it's safe even if a webhook retries or an admin double-clicks Approve.
 */
export async function markPaymentPaid(paymentId: string) {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment) return { ok: false, error: "Payment not found" };
  if (payment.status === "paid") return { ok: true, alreadyPaid: true };

  await db.update(payments).set({ status: "paid" }).where(eq(payments.id, payment.id));

  if (payment.purpose === "coaching" && payment.referenceId) {
    await db
      .update(liveSessionBookings)
      .set({ paymentStatus: "paid" })
      .where(eq(liveSessionBookings.id, payment.referenceId));

    const [booking] = await db
      .select()
      .from(liveSessionBookings)
      .where(eq(liveSessionBookings.id, payment.referenceId))
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
  } else if (payment.purpose === "store_order" && payment.referenceId) {
    await db.update(storeOrders).set({ status: "paid" }).where(eq(storeOrders.id, payment.referenceId));

    const [order] = await db.select().from(storeOrders).where(eq(storeOrders.id, payment.referenceId)).limit(1);
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
    await db.update(users).set({ isPaid: true, paidAt: new Date() }).where(eq(users.id, payment.userId));

    // Send the student a welcome/congratulations email now that they're
    // enrolled. Only reached once per payment (the "already paid" check at
    // the top of this function returns early on retries/double-approvals),
    // so this never double-sends. Silently no-ops if SMTP isn't configured.
    // Niche isn't chosen yet at enrollment time (that happens right after,
    // on /dashboard/choose-niche - see users.courseId), so this always uses
    // the generic program name rather than any one niche's course title.
    const [student] = await db.select().from(users).where(eq(users.id, payment.userId)).limit(1);
    if (student) {
      await sendWelcomeEmail({
        studentName: student.name,
        studentEmail: student.email,
        courseTitle: "The VA Atelier Training Program",
      });
    }
  }

  return { ok: true, alreadyPaid: false, purpose: payment.purpose };
}

/**
 * Rejects a manual-GCash payment submission (proof didn't check out) so the
 * student can see it wasn't approved and try again, rather than it just
 * sitting silently unpaid. Only meaningful for the manual_gcash path - a
 * PayMongo checkout failing is handled by the webhook's payment.failed case.
 */
export async function rejectManualPayment(paymentId: string) {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment) return { ok: false, error: "Payment not found" };
  if (payment.status === "paid") return { ok: false, error: "Already approved as paid - cannot reject." };

  await db.update(payments).set({ status: "rejected" }).where(eq(payments.id, payment.id));

  if (payment.purpose === "coaching" && payment.referenceId) {
    await db
      .update(liveSessionBookings)
      .set({ paymentStatus: "unpaid" })
      .where(eq(liveSessionBookings.id, payment.referenceId));
  } else if (payment.purpose === "store_order" && payment.referenceId) {
    await db.update(storeOrders).set({ status: "cancelled" }).where(eq(storeOrders.id, payment.referenceId));
  }

  return { ok: true };
}
