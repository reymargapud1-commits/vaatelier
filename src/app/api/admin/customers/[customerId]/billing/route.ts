import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { personalClients, personalClientCustomers, deliveryTrips, billingBatches } from "@/db/schema";

/**
 * The core "Generate Billing" action: takes a checked set of unbilled
 * deliveries and produces ONE billingBatch that both PDFs (Billing
 * Statement to the customer, Commission Invoice to the personal client -
 * see src/lib/billing-pdf.ts) are rendered from on demand. Marks every
 * included trip as billed (excluded from future selection) and advances
 * both numbering sequences so the next batch picks up the next number.
 */
export async function POST(req: Request, { params }: { params: { customerId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const [customer] = await db
    .select()
    .from(personalClientCustomers)
    .where(eq(personalClientCustomers.id, params.customerId))
    .limit(1);
  if (!customer) {
    return new NextResponse("Customer not found", { status: 404 });
  }
  const [client] = await db
    .select()
    .from(personalClients)
    .where(eq(personalClients.id, customer.personalClientId))
    .limit(1);
  if (!client) {
    return new NextResponse("Client not found", { status: 404 });
  }

  const form = await req.formData();
  const tripIds = form.getAll("tripIds").map(String).filter(Boolean);
  if (tripIds.length === 0) {
    return new NextResponse("Check at least one delivery to bill", { status: 400 });
  }

  // Only trips that actually belong to this customer AND are still unbilled
  // are eligible - this guards against a stale form (e.g. a trip that got
  // billed in another tab in the meantime) silently double-billing it.
  const trips = await db
    .select()
    .from(deliveryTrips)
    .where(
      and(
        eq(deliveryTrips.customerId, customer.id),
        isNull(deliveryTrips.billingBatchId),
        inArray(deliveryTrips.id, tripIds)
      )
    );
  if (trips.length === 0) {
    return new NextResponse("None of the checked deliveries are still available to bill", { status: 400 });
  }

  const subtotal = trips.reduce((s, t) => s + t.amountRate, 0);
  const vatAmount = subtotal * 0.12;
  const totalToCustomer = subtotal + vatAmount;
  const commissionTotal = trips.length * client.commissionRatePerTrip;

  const bsNumber = String(customer.nextBsNumber).padStart(4, "0");
  const invoiceNumber = `VA-${String(client.nextInvoiceNumber).padStart(4, "0")}`;

  const batchId = randomUUID();
  await db.insert(billingBatches).values({
    id: batchId,
    customerId: customer.id,
    personalClientId: client.id,
    bsNumber,
    invoiceNumber,
    tripCount: trips.length,
    subtotal,
    vatAmount,
    totalToCustomer,
    commissionTotal,
  });

  await db
    .update(deliveryTrips)
    .set({ billingBatchId: batchId })
    .where(
      and(
        eq(deliveryTrips.customerId, customer.id),
        isNull(deliveryTrips.billingBatchId),
        inArray(deliveryTrips.id, trips.map((t) => t.id))
      )
    );

  await db
    .update(personalClientCustomers)
    .set({ nextBsNumber: customer.nextBsNumber + 1 })
    .where(eq(personalClientCustomers.id, customer.id));
  await db
    .update(personalClients)
    .set({ nextInvoiceNumber: client.nextInvoiceNumber + 1 })
    .where(eq(personalClients.id, client.id));

  return NextResponse.redirect(new URL(`/admin/clients/${client.id}/billing/${batchId}`, req.url), { status: 303 });
}
