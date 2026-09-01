import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq, and } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { courses, liveSessionBookings } from "@/db/schema";
import { ANCHOR_COURSE_ID } from "@/lib/anchor-course";

// Booking creation now happens via /api/payment/create-booking-checkout
// (the 1-on-1 coaching add-on is paid, ₱300/2hrs). This route is
// read-only: it just reports the student's current booking (if any),
// including its paymentStatus, so the UI can show the right state.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  const [course] = await db.select().from(courses).where(eq(courses.id, ANCHOR_COURSE_ID)).limit(1);
  if (!course) return NextResponse.json({ booking: null });

  const [booking] = await db
    .select()
    .from(liveSessionBookings)
    .where(and(eq(liveSessionBookings.userId, userId), eq(liveSessionBookings.courseId, course.id)))
    .limit(1);

  return NextResponse.json({ booking: booking || null });
}
