import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { eq, and } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, courses, payments, liveSessionBookings } from "@/db/schema";
import { createCheckoutSession } from "@/lib/paymongo";
import { notifyCoachOfBooking } from "@/lib/notify";

const COACHING_PRICE_CENTAVOS = Number(process.env.COACHING_PRICE_CENTAVOS || 30000); // ₱300.00

/**
 * Starts a booking for the 1-on-1 live coaching add-on (₱300, 2 hours).
 * Open to EVERYONE, whether or not they're enrolled in the training - see
 * README. Enrolled (isPaid) students get their first-ever session free
 * (users.freeCoachingSessionUsed), confirmed immediately with no PayMongo
 * checkout. Every booking after that, and every booking from a
 * not-yet-enrolled student, goes through the normal paid checkout. The
 * coach is notified immediately for a free session, or once the webhook
 * confirms payment for a paid one.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  }

  const { scheduledAt, note, method } = (await req.json()) as {
    scheduledAt: string;
    note?: string;
    method?: "online" | "manual";
  };
  const date = new Date(scheduledAt);
  if (isNaN(date.getTime()) || date.getTime() < Date.now() + 60 * 60 * 1000) {
    return NextResponse.json(
      { error: "Please choose a date and time at least 1 hour from now." },
      { status: 400 }
    );
  }

  const [course] = await db.select().from(courses).limit(1);
  if (!course) return NextResponse.json({ error: "Course not configured" }, { status: 500 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const coachName = course.coachName || process.env.COACH_NAME || "Reymar Gapud";

  const [existing] = await db
    .select()
    .from(liveSessionBookings)
    .where(and(eq(liveSessionBookings.userId, userId), eq(liveSessionBookings.courseId, course.id)))
    .limit(1);

  // Rescheduling an already-confirmed session (paid or free) doesn't cost
  // anything extra - just move the date and re-notify the coach.
  if (existing && existing.paymentStatus === "paid") {
    await db
      .update(liveSessionBookings)
      .set({ scheduledAt: date, studentNote: note || null, status: "requested" })
      .where(eq(liveSessionBookings.id, existing.id));

    await notifyCoachOfBooking({
      bookingId: existing.id,
      studentName: user.name,
      studentEmail: user.email,
      coachName,
      scheduledAt: date,
      note: note || null,
      courseTitle: course.title,
    });

    return NextResponse.json({ checkoutUrl: `${siteUrl}/dashboard/booking/success` });
  }

  const isFreeSession = user.isPaid && !user.freeCoachingSessionUsed;
  const amount = isFreeSession ? 0 : COACHING_PRICE_CENTAVOS;
  const bookingId = existing?.id || randomUUID();

  if (existing) {
    await db
      .update(liveSessionBookings)
      .set({
        scheduledAt: date,
        studentNote: note || null,
        status: "requested",
        paymentStatus: isFreeSession ? "paid" : "pending",
        amountCentavos: amount,
      })
      .where(eq(liveSessionBookings.id, existing.id));
  } else {
    await db.insert(liveSessionBookings).values({
      id: bookingId,
      userId,
      courseId: course.id,
      scheduledAt: date,
      studentNote: note || null,
      paymentStatus: isFreeSession ? "paid" : "pending",
      amountCentavos: amount,
    });
  }

  if (isFreeSession) {
    await db.update(users).set({ freeCoachingSessionUsed: true }).where(eq(users.id, userId));

    await notifyCoachOfBooking({
      bookingId,
      studentName: user.name,
      studentEmail: user.email,
      coachName,
      scheduledAt: date,
      note: note || null,
      courseTitle: course.title,
    });

    return NextResponse.json({ checkoutUrl: `${siteUrl}/dashboard/booking/success` });
  }

  // Manual GCash path - same booking row as the online path, but no
  // PayMongo checkout: a payments row is created "awaiting_proof" instead,
  // and the student uploads a screenshot next (upload-proof route). An
  // admin then approves it on /admin/manual-payments, which is what
  // actually confirms the booking and notifies the coach.
  if (method === "manual") {
    const paymentId = randomUUID();
    await db.insert(payments).values({
      id: paymentId,
      userId: user.id,
      provider: "manual_gcash",
      status: "awaiting_proof",
      amountCentavos: amount,
      purpose: "coaching",
      referenceId: bookingId,
    });
    return NextResponse.json({ manual: true, paymentId, amountCentavos: amount });
  }

  try {
    const checkout = await createCheckoutSession({
      amountCentavos: amount,
      description: "1-on-1 Live Coaching Session with Coach Reymar (2 hrs)",
      userEmail: user.email,
      userName: user.name,
      userId: user.id,
      successUrl: `${siteUrl}/dashboard/booking/success`,
      cancelUrl: `${siteUrl}/dashboard/booking`,
      metadata: { purpose: "coaching", referenceId: bookingId },
    });

    await db
      .update(liveSessionBookings)
      .set({ checkoutSessionId: checkout.id })
      .where(eq(liveSessionBookings.id, bookingId));

    await db.insert(payments).values({
      id: randomUUID(),
      userId: user.id,
      checkoutSessionId: checkout.id,
      paymentIntentId: checkout.attributes.payment_intent?.id,
      status: "pending",
      amountCentavos: amount,
      purpose: "coaching",
      referenceId: bookingId,
    });

    return NextResponse.json({ checkoutUrl: checkout.attributes.checkout_url });
  } catch (err: any) {
    console.error("Booking checkout creation error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to start checkout. Please try again." },
      { status: 500 }
    );
  }
}
