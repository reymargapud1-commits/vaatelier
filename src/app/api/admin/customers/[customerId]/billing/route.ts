import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { personalClients, personalClientCustomers, deliveryTrips, billingBatches } from "@/db/schema";
import { redirectUrl } from "@/lib/redirect-url";

/**
 * The core "Generate Billing" action: takes a checked set of unbilled
 * deliveries and produces ONE billingBatch that its PDFs are rendered from
 * on demand (see src/lib/billing-pdf.ts). Marks every included trip as
 * billed (excluded from future selection) and advances the relevant
 * numbering sequence(s) so the next batch picks up the next number.
 *
 * Two customer.billingMode's (schema.ts):
 * - "commission" (e.g. 5RJSL -> Paintplas): Billing Statement (personal
 *   client -> customer, from amountRate) + a flat Commission Invoice (The
 *   VA Atelier -> personal client).
 * - "direct" (e.g. JJTS/RJC -> JMD): the same Billing Statement (from
 *   amountRate - the subcon rate) PLUS a second, real Billing Statement
 *   from The VA Atelier straight to the customer (from vaRate) - no
 *   Commission Invoice in this mode.
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

  const isDirect = customer.billingMode === "direct";

  if (isDirect && trips.some((t) => t.vaRate == null)) {
    return new NextResponse(
      "One or more checked deliveries is missing its The VA Atelier Rate - edit it before generating billing",
      { status: 400 }
    );
  }

  const subtotal = trips.reduce((s, t) => s + t.amountRate, 0);
  const vatAmount = subtotal * 0.12;
  const totalToCustomer = subtotal + vatAmount;
  const bsNumber = String(customer.nextBsNumber).padStart(4, "0");

  // "commission" mode only - left at 0/"" for "direct" mode batches, which
  // use vaSubtotal/vaVatAmount/vaTotal/vaBsNumber below instead.
  const commissionTotal = isDirect ? 0 : trips.length * client.commissionRatePerTrip;
  const invoiceNumber = isDirect ? "" : `VA-${String(client.nextInvoiceNumber).padStart(4, "0")}`;

  const vaSubtotal = isDirect ? trips.reduce((s, t) => s + (t.vaRate ?? 0), 0) : null;
  const vaVatAmount = isDirect ? vaSubtotal! * 0.12 : null;
  const vaTotal = isDirect ? vaSubtotal! + vaVatAmount! : null;
  const vaBsNumber = isDirect ? String(customer.vaNextBsNumber).padStart(4, "0") : null;

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
    vaBsNumber,
    vaSubtotal,
    vaVatAmount,
    vaTotal,
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

  if (isDirect) {
    await db
      .update(personalClientCustomers)
      .set({ nextBsNumber: customer.nextBsNumber + 1, vaNextBsNumber: customer.vaNextBsNumber + 1 })
      .where(eq(personalClientCustomers.id, customer.id));
  } else {
    await db
      .update(personalClientCustomers)
      .set({ nextBsNumber: customer.nextBsNumber + 1 })
      .where(eq(personalClientCustomers.id, customer.id));
    await db
      .update(personalClients)
      .set({ nextInvoiceNumber: client.nextInvoiceNumber + 1 })
      .where(eq(personalClients.id, client.id));
  }

  return NextResponse.redirect(redirectUrl(req, `/admin/clients/${client.id}/billing/${batchId}`), { status: 303 });
}
