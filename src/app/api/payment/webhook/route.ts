import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, payments } from "@/db/schema";
import { verifyPaymongoWebhookSignature } from "@/lib/paymongo";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("paymongo-signature");
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("PAYMONGO_WEBHOOK_SECRET is not set - rejecting webhook.");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const isLive = (process.env.PAYMONGO_SECRET_KEY || "").startsWith("sk_live_");
  const validSignature = verifyPaymongoWebhookSignature(
    rawBody,
    signatureHeader,
    webhookSecret,
    isLive
  );

  if (!validSignature) {
    console.warn("Invalid PayMongo webhook signature received.");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = event?.data?.attributes?.type;
  const eventData = event?.data?.attributes?.data;

  console.log("PayMongo webhook received:", eventType);

  // checkout_session.payment.paid fires when a checkout session is paid in full.
  if (eventType === "checkout_session.payment.paid") {
    const checkoutSessionId = eventData?.id;
    const userIdFromMetadata = eventData?.attributes?.metadata?.userId;

    if (checkoutSessionId) {
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.checkoutSessionId, checkoutSessionId))
        .limit(1);

      if (payment) {
        await db.update(payments).set({ status: "paid" }).where(eq(payments.id, payment.id));
        await db
          .update(users)
          .set({ isPaid: true, paidAt: new Date() })
          .where(eq(users.id, payment.userId));
      } else if (userIdFromMetadata) {
        // Fallback: use metadata if we somehow don't have a matching payment row.
        await db
          .update(users)
          .set({ isPaid: true, paidAt: new Date() })
          .where(eq(users.id, userIdFromMetadata));
      }
    }
  }

  // payment.failed - mark the payment row so support can investigate.
  if (eventType === "payment.failed") {
    const checkoutSessionId = eventData?.attributes?.checkout_session_id;
    if (checkoutSessionId) {
      await db
        .update(payments)
        .set({ status: "failed" })
        .where(eq(payments.checkoutSessionId, checkoutSessionId));
    }
  }

  return NextResponse.json({ received: true });
}
