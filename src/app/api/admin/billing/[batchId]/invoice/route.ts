import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { asc, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { personalClients, personalClientCustomers, billingBatches, deliveryTrips } from "@/db/schema";
import { generateCommissionInvoicePdf } from "@/lib/billing-pdf";

/** Streams the Service Invoice PDF (The VA Atelier -> personal client) for one batch. */
export async function GET(req: Request, { params }: { params: { batchId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const [batch] = await db.select().from(billingBatches).where(eq(billingBatches.id, params.batchId)).limit(1);
  if (!batch) return new NextResponse("Not found", { status: 404 });

  const [client] = await db.select().from(personalClients).where(eq(personalClients.id, batch.personalClientId)).limit(1);
  const [customer] = await db
    .select()
    .from(personalClientCustomers)
    .where(eq(personalClientCustomers.id, batch.customerId))
    .limit(1);
  if (!client || !customer) return new NextResponse("Not found", { status: 404 });

  const trips = await db
    .select()
    .from(deliveryTrips)
    .where(eq(deliveryTrips.billingBatchId, batch.id))
    .orderBy(asc(deliveryTrips.tripDate));

  const pdfBytes = await generateCommissionInvoicePdf(batch, client, customer, trips);

  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Service-Invoice-${batch.invoiceNumber}.pdf"`,
    },
  });
}
