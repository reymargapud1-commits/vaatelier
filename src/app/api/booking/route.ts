import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { eq, and } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, courses, liveSessionBookings } from "@/db/schema";
import { notifyCoachOfBooking } from "@/lib/notify";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.isPaid) {
    return NextResponse.json({ error: "Payment required" }, { status: 402 });
  }

  const { scheduledAt, note } = (await req.json()) as { scheduledAt: string; note?: string };
  const date = new Date(scheduledAt);
  if (isNaN(date.getTime()) || date.getTime() < Date.now() + 60 * 60 * 1000) {
    return NextResponse.json(
      { error: "Please choose a date and time at least 1 hour from now." },
      { status: 400 }
    );
  }

  const [course] = await db.select().from(courses).limit(1);
  if (!course) return NextResponse.json({ error: "Course not configured" }, { status: 500 });

  const [existing] = await db
    .select()
    .from(liveSessionBookings)
    .where(and(eq(liveSessionBookings.userId, userId), eq(liveSessionBookings.courseId, course.id)))
    .limit(1);

  const id = existing?.id || randomUUID();
  if (existing) {
    await db
      .update(liveSessionBookings)
      .set({ scheduledAt: date, studentNote: note || null, status: "requested" })
      .where(eq(liveSessionBookings.id, existing.id));
  } else {
    await db.insert(liveSessionBookings).values({
      id,
      userId,
      courseId: course.id,
      scheduledAt: date,
      studentNote: note || null,
    });
  }

  const coachName = course.coachName || process.env.COACH_NAME || "Reymar Gapud";
  await notifyCoachOfBooking({
    bookingId: id,
    studentName: user.name,
    studentEmail: user.email,
    coachName,
    scheduledAt: date,
    note,
    courseTitle: course.title,
  });

  return NextResponse.json({ success: true, bookingId: id });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  const [course] = await db.select().from(courses).limit(1);
  if (!course) return NextResponse.json({ booking: null });

  const [booking] = await db
    .select()
    .from(liveSessionBookings)
    .where(and(eq(liveSessionBookings.userId, userId), eq(liveSessionBookings.courseId, course.id)))
    .limit(1);

  return NextResponse.json({ booking: booking || null });
}
