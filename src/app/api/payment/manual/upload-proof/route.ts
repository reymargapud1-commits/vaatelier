import { NextResponse } from "next/server";
import fs from "fs";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { paymentProofPath } from "@/lib/payment-proof-storage";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB - plenty for a phone screenshot
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Second step of the manual-GCash payment flow (after create-checkout /
 * create-booking-checkout / create-order-checkout is called with
 * method:"manual" and returns a paymentId): the student attaches a
 * screenshot of their GCash payment as proof. Flips the payments row from
 * "awaiting_proof" to "pending_review" so it shows up on
 * /admin/manual-payments for the coach to approve.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  }
  const userId = (session.user as any).id;

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form submission." }, { status: 400 });
  }

  const paymentId = formData.get("paymentId");
  const note = formData.get("note");
  const proof = formData.get("proof");

  if (typeof paymentId !== "string" || !paymentId) {
    return NextResponse.json({ error: "Missing paymentId." }, { status: 400 });
  }
  if (!(proof instanceof File)) {
    return NextResponse.json({ error: "Please attach a screenshot of your payment." }, { status: 400 });
  }
  if (proof.size === 0) {
    return NextResponse.json({ error: "That file looks empty. Please try again." }, { status: 400 });
  }
  if (proof.size > MAX_BYTES) {
    return NextResponse.json({ error: "That image is too large (max 8MB)." }, { status: 400 });
  }
  const ext = ALLOWED_TYPES[proof.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Please upload a JPG, PNG, WEBP, or GIF screenshot." },
      { status: 400 }
    );
  }

  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }
  if (payment.userId !== userId) {
    return NextResponse.json({ error: "This payment doesn't belong to your account." }, { status: 403 });
  }
  if (payment.provider !== "manual_gcash") {
    return NextResponse.json({ error: "This payment isn't a manual GCash payment." }, { status: 400 });
  }
  if (payment.status !== "awaiting_proof") {
    return NextResponse.json(
      { error: "A proof screenshot was already submitted for this payment." },
      { status: 400 }
    );
  }

  const bytes = Buffer.from(await proof.arrayBuffer());
  fs.writeFileSync(paymentProofPath(paymentId, ext), bytes);

  await db
    .update(payments)
    .set({
      status: "pending_review",
      proofImagePath: `${paymentId}.${ext}`,
      note: typeof note === "string" && note.trim() ? note.trim() : null,
    })
    .where(eq(payments.id, paymentId));

  return NextResponse.json({ ok: true });
}
