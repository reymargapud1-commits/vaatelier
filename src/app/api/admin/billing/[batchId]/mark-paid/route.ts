import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { personalClientCustomers, billingBatches } from "@/db/schema";
import { redirectUrl } from "@/lib/redirect-url";

/**
 * Marks a "direct" mode batch (see personalClientCustomers.billingMode) as
 * paid: stamps batch.paidAt and issues this customer's next AR # for both
 * the vendor's own Acknowledgement Receipt (e.g. JJTS/RJC -> JMD) and The
 * VA Atelier's own Acknowledgement Receipt (The VA Atelier -> JMD) in one
 * step, since in practice JMD pays both at once (see the business-logic
 * note on billingMode). Commission-mode batches (5RJSL-style) never go
 * through this - they have no AR concept.
 */
export async function POST(req: Request, { params }: { params: { batchId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const [batch] = await db.select().from(billingBatches).where(eq(billingBatches.id, params.batchId)).limit(1);
  if (!batch) return new NextResponse("Not found", { status: 404 });
  if (batch.paidAt) {
    return new NextResponse("This batch has already been marked as paid", { status: 400 });
  }

  const [customer] = await db
    .select()
    .from(personalClientCustomers)
    .where(eq(personalClientCustomers.id, batch.customerId))
    .limit(1);
  if (!customer) return new NextResponse("Not found", { status: 404 });
  if (customer.billingMode !== "direct") {
    return new NextResponse("This customer's billing does not use Acknowledgement Receipts", { status: 400 });
  }

  const arNumber = String(customer.nextArNumber).padStart(4, "0");
  const vaArNumber = String(customer.vaNextArNumber).padStart(4, "0");

  await db
    .update(billingBatches)
    .set({ paidAt: new Date(), arNumber, vaArNumber })
    .where(eq(billingBatches.id, batch.id));

  await db
    .update(personalClientCustomers)
    .set({ nextArNumber: customer.nextArNumber + 1, vaNextArNumber: customer.vaNextArNumber + 1 })
    .where(eq(personalClientCustomers.id, customer.id));

  return NextResponse.redirect(redirectUrl(req, `/admin/clients/${batch.personalClientId}/billing/${batch.id}`), {
    status: 303,
  });
}
