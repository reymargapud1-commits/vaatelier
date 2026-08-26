import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, payments, storeOrders } from "@/db/schema";
import { createCheckoutSession } from "@/lib/paymongo";
import { getStoreItem } from "@/lib/store-items";

/**
 * Starts checkout for a custom VA document order (CV, portfolio, cover
 * letter, invoice format, intro presentation) - see lib/store-items.ts.
 * Creates a storeOrders row as "pending_payment" first, then redirects to
 * PayMongo; the webhook flips it to "paid" once payment is confirmed.
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

  const { itemKey, note } = (await req.json()) as { itemKey: string; note?: string };
  const item = getStoreItem(itemKey);
  if (!item) {
    return NextResponse.json({ error: "Unknown item." }, { status: 400 });
  }

  const orderId = randomUUID();
  await db.insert(storeOrders).values({
    id: orderId,
    userId,
    itemKey: item.key,
    itemLabel: item.label,
    amountCentavos: item.amountCentavos,
    customerNote: note || null,
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  try {
    const checkout = await createCheckoutSession({
      amountCentavos: item.amountCentavos,
      description: `The VA Atelier Store - ${item.label}`,
      userEmail: user.email,
      userName: user.name,
      userId: user.id,
      successUrl: `${siteUrl}/dashboard/store/success`,
      cancelUrl: `${siteUrl}/dashboard/store`,
      metadata: { purpose: "store_order", referenceId: orderId },
    });

    await db.update(storeOrders).set({ checkoutSessionId: checkout.id }).where(eq(storeOrders.id, orderId));

    await db.insert(payments).values({
      id: randomUUID(),
      userId: user.id,
      checkoutSessionId: checkout.id,
      paymentIntentId: checkout.attributes.payment_intent?.id,
      status: "pending",
      amountCentavos: item.amountCentavos,
      purpose: "store_order",
      referenceId: orderId,
    });

    return NextResponse.json({ checkoutUrl: checkout.attributes.checkout_url });
  } catch (err: any) {
    console.error("Order checkout creation error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to start checkout. Please try again." },
      { status: 500 }
    );
  }
}
