import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payments, users, liveSessionBookings, storeOrders, courses } from "@/db/schema";
import { sendWelcomeEmail, notifyCoachOfBooking } from "./notify";

/**
 * Shared "a payment just got confirmed" logic, used by BOTH the PayMongo
 * webhook (checkout_session.payment.paid) and the manual-GCash admin
 * approval action (/admin/manual-payments) - so what happens on payment
 * confirmation isn't duplicated in two places. Branches on `payments.purpose`
 * to apply the right side effect (see db/schema.ts). Idempotent: calling
 * this again for an already-paid payment is a safe no-op (README "Security
 * notes" - re-approving an already-paid manual payment must not double up
 * enrollment/booking/order effects).
 */
export async function markPaymentPaid(paymentId: string): Promise<{ ok: boolean; error?: string }> {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment) {
    return { ok: false, error: "Payment not found." };
  }

  if (payment.status === "paid") {
    return { ok: true };
  }

  if (payment.purpose === "enrollment") {
    const [student] = await db.select().from(users).where(eq(users.id, payment.userId)).limit(1);
    if (student) {
      await db
        .update(users)
        .set({ isPaid: true, paidAt: new Date() })
        .where(eq(users.id, student.id));

      await sendWelcomeEmail({
        studentName: student.name,
        studentEmail: student.email,
        // Niche isn't chosen until right after enrollment (users.courseId
        // is still null here), so this always uses the generic program
        // name rather than any one niche's course title.
        courseTitle: "The VA Atelier Training Program",
      });
    }
  } else if (payment.purpose === "coaching" && payment.referenceId) {
    const [booking] = await db
      .select()
      .from(liveSessionBookings)
      .where(eq(liveSessionBookings.id, payment.referenceId))
      .limit(1);

    if (booking) {
      await db
        .update(liveSessionBookings)
        .set({ paymentStatus: "paid" })
        .where(eq(liveSessionBookings.id, booking.id));

      const [student] = await db.select().from(users).where(eq(users.id, booking.userId)).limit(1);
      const [course] = await db.select().from(courses).where(eq(courses.id, booking.courseId)).limit(1);

      if (student) {
        const coachName = course?.coachName || process.env.COACH_NAME || "Reymar Gapud";
        await notifyCoachOfBooking({
          bookingId: booking.id,
          studentName: student.name,
          studentEmail: student.email,
          coachName,
          scheduledAt: booking.scheduledAt,
          note: booking.studentNote,
          courseTitle: course?.title || "The VA Atelier Training Program",
        });
      }
    }
  } else if (payment.purpose === "store_order" && payment.referenceId) {
    await db
      .update(storeOrders)
      .set({ status: "paid", updatedAt: new Date() })
      .where(eq(storeOrders.id, payment.referenceId));
  }

  await db.update(payments).set({ status: "paid", updatedAt: new Date() }).where(eq(payments.id, payment.id));

  return { ok: true };
}

/**
 * Rejects a manual-GCash payment under review (/admin/manual-payments) -
 * the student is left to submit a new proof screenshot if they try again.
 * Only meaningful for payments still awaiting a decision; rejecting an
 * already-approved payment is refused rather than silently undoing it.
 */
export async function rejectManualPayment(paymentId: string): Promise<{ ok: boolean; error?: string }> {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment) {
    return { ok: false, error: "Payment not found." };
  }
  if (payment.provider !== "manual_gcash") {
    return { ok: false, error: "Only manual GCash payments can be rejected here." };
  }
  if (payment.status === "paid") {
    return { ok: false, error: "This payment has already been approved and can't be rejected." };
  }

  await db.update(payments).set({ status: "rejected", updatedAt: new Date() }).where(eq(payments.id, payment.id));

  return { ok: true };
}
