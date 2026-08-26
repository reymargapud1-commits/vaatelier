import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { eq, and } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, courses, payments, liveSessionBookings } from "@/db/schema";
import { createCheckoutSession } from "@/lib/paymongo";

const COACHING_PRICE_CENTAVOS = Number(process.env.COACHING_PRICE_CENTAVOS || 30000); // ₱300.00

/**
 * Starts checkout for the OPTIONAL 1-on-1 live coaching add-on (₱300, 2
 * hours). Unlike enrollment, this is never required for a certificate -
 * see lib/certificate-eligibility.ts. Creates/updates the student's
 * liveSessionBookings row as "pending" payment, then redirects to PayMongo.
 * The coach is only notified once the webhook confirms payment.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.isPaid) {
    return NextResponse.json({ error: "Enroll in the training program first." }, { status: 402 });
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

  const bookingId = existing?.id || randomUUID();
  if (existing) {
    await db
      .update(liveSessionBookings)
      .set({
        scheduledAt: date,
        studentNote: note || null,
        status: "requested",
        paymentStatus: "pending",
        amountCentavos: COACHING_PRICE_CENTAVOS,
      })
      .where(eq(liveSessionBookings.id, existing.id));
  } else {
    await db.insert(liveSessionBookings).values({
      id: bookingId,
      userId,
      courseId: course.id,
      scheduledAt: date,
      studentNote: note || null,
      paymentStatus: "pending",
      amountCentavos: COACHING_PRICE_CENTAVOS,
    });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  try {
    const checkout = await createCheckoutSession({
      amountCentavos: COACHING_PRICE_CENTAVOS,
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
      amountCentavos: COACHING_PRICE_CENTAVOS,
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
