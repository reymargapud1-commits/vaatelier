import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { billingBatches, deliveryTrips, personalClientCustomers, personalClients } from "@/db/schema";
import { redirectUrl } from "@/lib/redirect-url";

/**
 * Deletes a generated billing batch (e.g. a trial/mistaken run) and returns
 * its deliveries to the Unbilled list instead of losing them - this is an
 * "undo", not a permanent erase of the underlying delivery data. If this was
 * the MOST RECENT batch for its customer/client (nothing was generated
 * after it), the BS # and Invoice # sequences are also rolled back by one,
 * so the very next batch generated picks up the same number again instead
 * of leaving a gap. If a newer batch already exists, the numbers are left
 * alone (rolling back would create a duplicate number for that newer one).
 */
export async function POST(req: Request, { params }: { params: { batchId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const [batch] = await db.select().from(billingBatches).where(eq(billingBatches.id, params.batchId)).limit(1);
  if (!batch) {
    return new NextResponse("Billing statement not found", { status: 404 });
  }

  const [customer] = await db
    .select()
    .from(personalClientCustomers)
    .where(eq(personalClientCustomers.id, batch.customerId))
    .limit(1);
  const [client] = await db.select().from(personalClients).where(eq(personalClients.id, batch.personalClientId)).limit(1);

  // Return this batch's deliveries to Unbilled rather than deleting them.
  await db.update(deliveryTrips).set({ billingBatchId: null }).where(eq(deliveryTrips.billingBatchId, batch.id));

  await db.delete(billingBatches).where(eq(billingBatches.id, batch.id));

  // Roll back the BS # sequence(s) - and, if this batch was ever marked
  // paid, the AR # sequence(s) too - only if this batch was the latest one
  // issued to this customer (i.e. nothing has been numbered after it yet).
  // "direct" mode batches (customer.billingMode) also have their own
  // vaBsNumber/vaArNumber sequence (The VA Atelier -> customer), rolled
  // back the same way.
  if (customer) {
    const rollback: Partial<typeof customer> = {};

    const batchBsNumber = parseInt(batch.bsNumber, 10);
    if (!isNaN(batchBsNumber) && customer.nextBsNumber === batchBsNumber + 1) {
      rollback.nextBsNumber = batchBsNumber;
    }
    if (batch.vaBsNumber) {
      const batchVaBsNumber = parseInt(batch.vaBsNumber, 10);
      if (!isNaN(batchVaBsNumber) && customer.vaNextBsNumber === batchVaBsNumber + 1) {
        rollback.vaNextBsNumber = batchVaBsNumber;
      }
    }
    if (batch.arNumber) {
      const batchArNumber = parseInt(batch.arNumber, 10);
      if (!isNaN(batchArNumber) && customer.nextArNumber === batchArNumber + 1) {
        rollback.nextArNumber = batchArNumber;
      }
    }
    if (batch.vaArNumber) {
      const batchVaArNumber = parseInt(batch.vaArNumber, 10);
      if (!isNaN(batchVaArNumber) && customer.vaNextArNumber === batchVaArNumber + 1) {
        rollback.vaNextArNumber = batchVaArNumber;
      }
    }

    if (Object.keys(rollback).length > 0) {
      await db.update(personalClientCustomers).set(rollback).where(eq(personalClientCustomers.id, customer.id));
    }
  }

  // Same idea for the personal client's own commission-invoice sequence -
  // invoiceNumber is stored like "VA-0001".
  if (client) {
    const batchInvoiceNumber = parseInt(batch.invoiceNumber.replace(/^VA-/, ""), 10);
    if (!isNaN(batchInvoiceNumber) && client.nextInvoiceNumber === batchInvoiceNumber + 1) {
      await db
        .update(personalClients)
        .set({ nextInvoiceNumber: batchInvoiceNumber })
        .where(eq(personalClients.id, client.id));
    }
  }

  const backTo = customer
    ? `/admin/clients/${batch.personalClientId}/customers/${batch.customerId}`
    : `/admin/clients/${batch.personalClientId}`;

  return NextResponse.redirect(redirectUrl(req, backTo), { status: 303 });
}
