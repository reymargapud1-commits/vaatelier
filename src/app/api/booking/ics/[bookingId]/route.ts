import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, courses, liveSessionBookings } from "@/db/schema";
import { buildBookingICS } from "@/lib/notify";

export async function GET(_req: Request, { params }: { params: { bookingId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const userId = (session.user as any).id;
  const [booking] = await db
    .select()
    .from(liveSessionBookings)
    .where(eq(liveSessionBookings.id, params.bookingId))
    .limit(1);
  if (!booking) return new NextResponse("Not found", { status: 404 });

  const [user] = await db.select().from(users).where(eq(users.id, booking.userId)).limit(1);
  const isOwner = booking.userId === userId;
  const isAdmin = (session.user as any).role === "admin";
  if (!isOwner && !isAdmin) return new NextResponse("Forbidden", { status: 403 });
  if (!user) return new NextResponse("Not found", { status: 404 });

  const [course] = await db.select().from(courses).where(eq(courses.id, booking.courseId)).limit(1);
  const coachName = course?.coachName || process.env.COACH_NAME || "Reymar Gapud";

  const ics = buildBookingICS({
    bookingId: booking.id,
    studentName: user.name,
    studentEmail: user.email,
    coachName,
    scheduledAt: booking.scheduledAt,
    note: booking.studentNote,
    courseTitle: course?.title || "The VA Atelier Training Program",
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="live-training-session.ics"',
    },
  });
}
