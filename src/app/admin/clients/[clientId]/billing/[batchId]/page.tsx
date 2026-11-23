import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { personalClients, personalClientCustomers, billingBatches, deliveryTrips } from "@/db/schema";
import Navbar from "@/components/Navbar";

export default async function BillingBatchPage({
  params,
}: {
  params: { clientId: string; batchId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "admin") redirect("/dashboard");

  const [client] = await db.select().from(personalClients).where(eq(personalClients.id, params.clientId)).limit(1);
  if (!client) notFound();

  const [batch] = await db
    .select()
    .from(billingBatches)
    .where(and(eq(billingBatches.id, params.batchId), eq(billingBatches.personalClientId, client.id)))
    .limit(1);
  if (!batch) notFound();

  const [customer] = await db
    .select()
    .from(personalClientCustomers)
    .where(eq(personalClientCustomers.id, batch.customerId))
    .limit(1);

  const trips = await db
    .select()
    .from(deliveryTrips)
    .where(eq(deliveryTrips.billingBatchId, batch.id))
    .orderBy(asc(deliveryTrips.tripDate));

  const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
  const isDirect = customer?.billingMode === "direct";
  const isPaid = !!batch.paidAt;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link
          href={`/admin/clients/${client.id}/customers/${batch.customerId}`}
          className="mb-4 inline-block text-sm text-brand-700 hover:underline"
        >
          ← Back to {customer?.name || "customer"} monitoring
        </Link>

        <h1 className="mb-1 text-2xl font-bold text-gray-900">Billing Batch — BS #{batch.bsNumber}</h1>
        <p className="mb-8 text-sm text-gray-500">
          {new Date(batch.batchDate).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })} ·{" "}
          {batch.tripCount} delivery(ies)
        </p>

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="card">
            <h2 className="mb-1 font-bold text-gray-900">Billing Statement</h2>
            <p className="mb-3 text-sm text-gray-500">
              {client.name} → {customer?.name}
            </p>
            <dl className="space-y-1 text-sm text-gray-700">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{peso(batch.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>VAT (12%)</dt>
                <dd>{peso(batch.vatAmount)}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-1 font-semibold text-gray-900">
                <dt>Total</dt>
                <dd>{peso(batch.totalToCustomer)}</dd>
              </div>
            </dl>
            <a
              href={`/api/admin/billing/${batch.id}/statement`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary mt-4 block text-center"
            >
              Download Billing Statement (PDF)
            </a>
          </div>

          {isDirect ? (
            <div className="card">
              <h2 className="mb-1 font-bold text-gray-900">The VA Atelier Billing Statement</h2>
              <p className="mb-3 text-sm text-gray-500">
                The VA Atelier → {customer?.name} (real rate)
              </p>
              <dl className="space-y-1 text-sm text-gray-700">
                <div className="flex justify-between">
                  <dt>BS #</dt>
                  <dd>{batch.vaBsNumber}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Subtotal</dt>
                  <dd>{peso(batch.vaSubtotal ?? 0)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>VAT (12%)</dt>
                  <dd>{peso(batch.vaVatAmount ?? 0)}</dd>
                </div>
                <div className="flex justify-between border-t border-gray-100 pt-1 font-semibold text-gray-900">
                  <dt>Total</dt>
                  <dd>{peso(batch.vaTotal ?? 0)}</dd>
                </div>
              </dl>
              <a
                href={`/api/admin/billing/${batch.id}/va-statement`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mt-4 block text-center"
              >
                Download The VA Atelier Billing Statement (PDF)
              </a>
            </div>
          ) : (
            <div className="card">
              <h2 className="mb-1 font-bold text-gray-900">Your Commission Invoice</h2>
              <p className="mb-3 text-sm text-gray-500">The VA Atelier → {client.name}</p>
              <dl className="space-y-1 text-sm text-gray-700">
                <div className="flex justify-between">
                  <dt>Invoice #</dt>
                  <dd>{batch.invoiceNumber}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Rate</dt>
                  <dd>
                    {batch.tripCount} × {peso(client.commissionRatePerTrip)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-gray-100 pt-1 font-semibold text-gray-900">
                  <dt>Total Due</dt>
                  <dd>{peso(batch.commissionTotal)}</dd>
                </div>
              </dl>
              <a
                href={`/api/admin/billing/${batch.id}/invoice`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mt-4 block text-center"
              >
                Download Service Invoice (PDF)
              </a>
            </div>
          )}
        </div>

        {isDirect && (
          <div className="card mb-6">
            <h2 className="mb-1 font-bold text-gray-900">Payment &amp; Acknowledgement Receipts</h2>
            <p className="mb-3 text-sm text-gray-500">
              For the paper trail: once {customer?.name} pays, mark this batch as paid to issue both Acknowledgement
              Receipts (vendor + The VA Atelier), each addressed to {customer?.name}.
            </p>
            {isPaid ? (
              <>
                <p className="mb-3 text-sm text-gray-700">
                  Paid on{" "}
                  {batch.paidAt &&
                    new Date(batch.paidAt).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
                  .
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <a
                    href={`/api/admin/billing/${batch.id}/receipt`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary block text-center"
                  >
                    Download Acknowledgement Receipt — AR #{batch.arNumber}
                  </a>
                  <a
                    href={`/api/admin/billing/${batch.id}/va-receipt`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary block text-center"
                  >
                    Download The VA Atelier AR — AR #{batch.vaArNumber}
                  </a>
                </div>
              </>
            ) : (
              <form action={`/api/admin/billing/${batch.id}/mark-paid`} method="POST">
                <button type="submit" className="btn-primary">
                  Mark as Paid &amp; Issue Acknowledgement Receipts
                </button>
              </form>
            )}
          </div>
        )}

        <h2 className="mb-3 font-bold text-gray-900">Deliveries in this Batch</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Plate #</th>
                <th className="px-3 py-2 font-medium">Driver</th>
                <th className="px-3 py-2 font-medium">Route</th>
                <th className="px-3 py-2 font-medium">{isDirect ? "Subcon Rate" : "Amount"}</th>
                {isDirect && <th className="px-3 py-2 font-medium">The VA Atelier Rate</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {trips.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2 text-gray-700">{new Date(t.tripDate).toLocaleDateString("en-PH")}</td>
                  <td className="px-3 py-2 text-gray-700">{t.plateNumber}</td>
                  <td className="px-3 py-2 text-gray-700">{t.driverName}</td>
                  <td className="px-3 py-2 text-gray-700">
                    {t.routeFrom} → {t.routeTo}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{peso(t.amountRate)}</td>
                  {isDirect && <td className="px-3 py-2 text-gray-700">{peso(t.vaRate ?? 0)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
