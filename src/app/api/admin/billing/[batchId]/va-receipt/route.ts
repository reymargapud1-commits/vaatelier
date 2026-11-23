import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { personalClientCustomers, billingBatches } from "@/db/schema";
import { generateVaAcknowledgementReceiptPdf } from "@/lib/billing-pdf";

/**
 * Streams The VA Atelier's OWN Acknowledgement Receipt PDF (The VA Atelier
 * -> customer, e.g. JMD) for one "direct" mode batch - only available once
 * the batch has been marked as paid (batch.vaArNumber set - see the
 * mark-paid route).
 */
export async function GET(req: Request, { params }: { params: { batchId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const [batch] = await db.select().from(billingBatches).where(eq(billingBatches.id, params.batchId)).limit(1);
  if (!batch) return new NextResponse("Not found", { status: 404 });
  if (!batch.vaArNumber) {
    return new NextResponse("This batch has not been marked as paid yet", { status: 400 });
  }

  const [customer] = await db
    .select()
    .from(personalClientCustomers)
    .where(eq(personalClientCustomers.id, batch.customerId))
    .limit(1);
  if (!customer) return new NextResponse("Not found", { status: 404 });

  const pdfBytes = await generateVaAcknowledgementReceiptPdf(batch, customer);

  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="VA-Atelier-Acknowledgement-Receipt-${batch.vaArNumber}.pdf"`,
    },
  });
}
