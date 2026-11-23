import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { asc, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { personalClientCustomers, billingBatches, deliveryTrips } from "@/db/schema";
import { generateVaDirectBillingStatementPdf } from "@/lib/billing-pdf";

/**
 * Streams The VA Atelier's OWN Billing Statement PDF (The VA Atelier ->
 * customer, from vaRate) for one "direct" mode batch - see
 * personalClientCustomers.billingMode in schema.ts. Only exists for direct
 * mode batches; commission-mode batches never have a vaBsNumber.
 */
export async function GET(req: Request, { params }: { params: { batchId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const [batch] = await db.select().from(billingBatches).where(eq(billingBatches.id, params.batchId)).limit(1);
  if (!batch) return new NextResponse("Not found", { status: 404 });
  if (!batch.vaBsNumber) {
    return new NextResponse("This batch has no The VA Atelier Billing Statement", { status: 400 });
  }

  const [customer] = await db
    .select()
    .from(personalClientCustomers)
    .where(eq(personalClientCustomers.id, batch.customerId))
    .limit(1);
  if (!customer) return new NextResponse("Not found", { status: 404 });

  const trips = await db
    .select()
    .from(deliveryTrips)
    .where(eq(deliveryTrips.billingBatchId, batch.id))
    .orderBy(asc(deliveryTrips.tripDate));

  const pdfBytes = await generateVaDirectBillingStatementPdf(batch, customer, trips);

  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="VA-Atelier-Billing-Statement-${batch.vaBsNumber}.pdf"`,
    },
  });
}
