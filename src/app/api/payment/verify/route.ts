import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, desc, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, payments } from "@/db/schema";
import { retrieveCheckoutSession } from "@/lib/paymongo";

/**
 * Fallback verification endpoint hit by /payment/success in case the
 * PayMongo webhook hasn't landed yet (e.g. local dev without a public
 * tunnel). Looks up the user's most recent pending payment and checks its
 * live status directly with PayMongo.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (user.isPaid) {
    return NextResponse.json({ isPaid: true });
  }

  const [pendingPayment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.userId, userId), eq(payments.status, "pending")))
    .orderBy(desc(payments.createdAt))
    .limit(1);

  if (!pendingPayment?.checkoutSessionId) {
    return NextResponse.json({ isPaid: false });
  }

  try {
    const checkout = await retrieveCheckoutSession(pendingPayment.checkoutSessionId);
    const paid = (checkout.attributes.payments || []).some(
      (p: any) => p?.attributes?.status === "paid"
    );

    if (paid) {
      await db.update(payments).set({ status: "paid" }).where(eq(payments.id, pendingPayment.id));
      await db.update(users).set({ isPaid: true, paidAt: new Date() }).where(eq(users.id, userId));
      return NextResponse.json({ isPaid: true });
    }
  } catch (err) {
    console.error("Payment verify fallback error:", err);
  }

  return NextResponse.json({ isPaid: false });
}
