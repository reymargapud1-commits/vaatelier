import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { courses, liveSessionBookings } from "@/db/schema";
import { retrieveCheckoutSession } from "@/lib/paymongo";
import { ANCHOR_COURSE_ID } from "@/lib/anchor-course";

/**
 * Fallback verification for the optional coaching-session checkout, hit by
 * /dashboard/booking/success in case the PayMongo webhook hasn't landed
 * yet. Mirrors /api/payment/verify but checks liveSessionBookings.paymentStatus
 * instead of users.isPaid.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  const [course] = await db.select().from(courses).where(eq(courses.id, ANCHOR_COURSE_ID)).limit(1);
  if (!course) return NextResponse.json({ isPaid: false });

  const [booking] = await db
    .select()
    .from(liveSessionBookings)
    .where(and(eq(liveSessionBookings.userId, userId), eq(liveSessionBookings.courseId, course.id)))
    .limit(1);

  if (!booking) return NextResponse.json({ isPaid: false });
  if (booking.paymentStatus === "paid") return NextResponse.json({ isPaid: true });
  if (!booking.checkoutSessionId) return NextResponse.json({ isPaid: false });

  try {
    const checkout = await retrieveCheckoutSession(booking.checkoutSessionId);
    const paid = (checkout.attributes.payments || []).some(
      (p: any) => p?.attributes?.status === "paid"
    );
    if (paid) {
      await db
        .update(liveSessionBookings)
        .set({ paymentStatus: "paid" })
        .where(eq(liveSessionBookings.id, booking.id));
      return NextResponse.json({ isPaid: true });
    }
  } catch (err) {
    console.error("Booking payment verify fallback error:", err);
  }

  return NextResponse.json({ isPaid: false });
}
