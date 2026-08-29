import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, desc, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { storeOrders } from "@/db/schema";
import { retrieveCheckoutSession } from "@/lib/paymongo";

/**
 * Fallback verification for a store-order checkout, hit by
 * /dashboard/store/success in case the PayMongo webhook hasn't landed yet.
 * Checks the student's most recent pending_payment order.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  const [order] = await db
    .select()
    .from(storeOrders)
    .where(and(eq(storeOrders.userId, userId), eq(storeOrders.status, "pending_payment")))
    .orderBy(desc(storeOrders.createdAt))
    .limit(1);

  if (!order?.checkoutSessionId) return NextResponse.json({ isPaid: false });

  try {
    const checkout = await retrieveCheckoutSession(order.checkoutSessionId);
    const paid = (checkout.attributes.payments || []).some(
      (p: any) => p?.attributes?.status === "paid"
    );
    if (paid) {
      await db.update(storeOrders).set({ status: "paid" }).where(eq(storeOrders.id, order.id));
      return NextResponse.json({ isPaid: true });
    }
  } catch (err) {
    console.error("Order payment verify fallback error:", err);
  }

  return NextResponse.json({ isPaid: false });
}
