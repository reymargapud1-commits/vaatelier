import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, courses, payments } from "@/db/schema";
import { createCheckoutSession } from "@/lib/paymongo";
import { ANCHOR_COURSE_ID } from "@/lib/anchor-course";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, (session.user as any).id)).limit(1);
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (user.isPaid) {
    return NextResponse.json({ alreadyPaid: true });
  }

  // Enrollment happens BEFORE a student picks a niche (see
  // /dashboard/choose-niche), so there's no "their" course yet to read a
  // price/title from - every niche's course row carries the same
  // enrollment price anyway, so this just anchors to one fixed, always-
  // present course id rather than an arbitrary/unordered one.
  const [course] = await db.select().from(courses).where(eq(courses.id, ANCHOR_COURSE_ID)).limit(1);
  if (!course) {
    return NextResponse.json({ error: "Course not configured yet." }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const method = body?.method === "manual" ? "manual" : "online";

  // Manual GCash path: no PayMongo channels needed at all. Just records a
  // payments row awaiting a proof-of-payment screenshot (uploaded next via
  // /api/payment/manual/upload-proof) for an admin to review and approve on
  // /admin/manual-payments - see lib/payment-fulfillment.ts.
  if (method === "manual") {
    const paymentId = randomUUID();
    await db.insert(payments).values({
      id: paymentId,
      userId: user.id,
      provider: "manual_gcash",
      status: "awaiting_proof",
      amountCentavos: course.priceCentavos,
      purpose: "enrollment",
    });
    return NextResponse.json({ manual: true, paymentId, amountCentavos: course.priceCentavos });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  try {
    const checkout = await createCheckoutSession({
      amountCentavos: course.priceCentavos,
      description: "The VA Atelier Training Program - Full Access",
      userEmail: user.email,
      userName: user.name,
      userId: user.id,
      successUrl: `${siteUrl}/payment/success`,
      cancelUrl: `${siteUrl}/payment`,
    });

    await db.insert(payments).values({
      id: randomUUID(),
      userId: user.id,
      checkoutSessionId: checkout.id,
      paymentIntentId: checkout.attributes.payment_intent?.id,
      status: "pending",
      amountCentavos: course.priceCentavos,
    });

    return NextResponse.json({ checkoutUrl: checkout.attributes.checkout_url });
  } catch (err: any) {
    console.error("Checkout creation error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to start checkout. Please try again." },
      { status: 500 }
    );
  }
}
