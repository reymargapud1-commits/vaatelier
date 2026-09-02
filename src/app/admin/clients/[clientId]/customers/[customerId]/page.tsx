import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { personalClients, personalClientCustomers, deliveryTrips, billingBatches } from "@/db/schema";
import Navbar from "@/components/Navbar";

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

export default async function CustomerMonitoringPage({
  params,
}: {
  params: { clientId: string; customerId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "admin") redirect("/dashboard");

  const [client] = await db.select().from(personalClients).where(eq(personalClients.id, params.clientId)).limit(1);
  if (!client) notFound();

  const [customer] = await db
    .select()
    .from(personalClientCustomers)
    .where(and(eq(personalClientCustomers.id, params.customerId), eq(personalClientCustomers.personalClientId, client.id)))
    .limit(1);
  if (!customer) notFound();

  const unbilledTrips = await db
    .select()
    .from(deliveryTrips)
    .where(and(eq(deliveryTrips.customerId, customer.id), isNull(deliveryTrips.billingBatchId)))
    .orderBy(asc(deliveryTrips.tripDate));

  const recentBatches = await db
    .select()
    .from(billingBatches)
    .where(eq(billingBatches.customerId, customer.id))
    .orderBy(desc(billingBatches.batchDate))
    .limit(10);

  const unbilledSubtotal = unbilledTrips.reduce((s, t) => s + t.amountRate, 0);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <Link href={`/admin/clients/${client.id}`} className="mb-4 inline-block text-sm text-brand-700 hover:underline">
          ← Back to {client.name}
        </Link>
        <h1 className="mb-1 text-2xl font-bold text-gray-900">{customer.name}</h1>
        <p className="mb-8 text-sm text-gray-500">Delivery monitoring, billed on behalf of {client.name}</p>

        <div className="card mb-8">
          <h2 className="mb-4 font-bold text-gray-900">Log a Delivery</h2>
          <form action={`/api/admin/customers/${customer.id}/trips`} method="POST" className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
                <input name="tripDate" type="date" required className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Plate #</label>
                <input name="plateNumber" required className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Driver's Name</label>
                <input name="driverName" required className="input" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Helper's Name (1)</label>
                <input name="helper1Name" className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Helper's Name (2)</label>
                <input name="helper2Name" className="input" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Route: From</label>
                <input name="routeFrom" required className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Route: To</label>
                <input name="routeTo" required className="input" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Gate Pass #</label>
                <input name="gatePassNumber" className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">DR/SI #</label>
                <input name="drSiNumber" className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Waybill #</label>
                <input name="waybillNumber" className="input" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Remarks</label>
                <input name="remarks" className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Amount Rate (₱, VAT-exclusive)</label>
                <input name="amountRate" type="number" step="0.01" min="0" required className="input" />
              </div>
            </div>
            <button type="submit" className="btn-primary">
              Add Delivery
            </button>
          </form>
        </div>

        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Unbilled Deliveries ({unbilledTrips.length})</h2>
            <p className="text-sm text-gray-500">
              Subtotal: ₱{unbilledSubtotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </p>
          </div>

          {unbilledTrips.length === 0 ? (
            <p className="text-sm text-gray-500">No unbilled deliveries - add one above.</p>
          ) : (
            <form action={`/api/admin/customers/${customer.id}/billing`} method="POST">
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-3 py-2"></th>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Plate #</th>
                      <th className="px-3 py-2 font-medium">Driver</th>
                      <th className="px-3 py-2 font-medium">Helpers</th>
                      <th className="px-3 py-2 font-medium">From</th>
                      <th className="px-3 py-2 font-medium">To</th>
                      <th className="px-3 py-2 font-medium">Gate Pass #</th>
                      <th className="px-3 py-2 font-medium">DR/SI #</th>
                      <th className="px-3 py-2 font-medium">Waybill #</th>
                      <th className="px-3 py-2 font-medium">Remarks</th>
                      <th className="px-3 py-2 font-medium">Amount</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {unbilledTrips.map((t) => (
                      <tr key={t.id}>
                        <td className="px-3 py-2">
                          <input type="checkbox" name="tripIds" value={t.id} defaultChecked />
                        </td>
                        <td className="px-3 py-2 text-gray-700">{fmtDate(t.tripDate)}</td>
                        <td className="px-3 py-2 text-gray-700">{t.plateNumber}</td>
                        <td className="px-3 py-2 text-gray-700">{t.driverName}</td>
                        <td className="px-3 py-2 text-gray-700">
                          {[t.helper1Name, t.helper2Name].filter(Boolean).join(", ")}
                        </td>
                        <td className="px-3 py-2 text-gray-700">{t.routeFrom}</td>
                        <td className="px-3 py-2 text-gray-700">{t.routeTo}</td>
                        <td className="px-3 py-2 text-gray-700">{t.gatePassNumber}</td>
                        <td className="px-3 py-2 text-gray-700">{t.drSiNumber}</td>
                        <td className="px-3 py-2 text-gray-700">{t.waybillNumber}</td>
                        <td className="px-3 py-2 text-gray-700">{t.remarks}</td>
                        <td className="px-3 py-2 text-gray-700">
                          ₱{t.amountRate.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            formAction={`/api/admin/trips/${t.id}/delete`}
                            formMethod="POST"
                            className="text-red-600 hover:underline"
                            title="Remove this delivery"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="submit" className="btn-primary">
                  Generate Billing for Checked Deliveries
                </button>
                <p className="text-xs text-gray-500">
                  This creates Billing Statement #{String(customer.nextBsNumber).padStart(4, "0")} to{" "}
                  {customer.name}, and Invoice #VA-{String(client.nextInvoiceNumber).padStart(4, "0")} for your
                  commission from {client.name} - both from the deliveries checked above.
                </p>
              </div>
            </form>
          )}
        </div>

        <div>
          <h2 className="mb-3 font-bold text-gray-900">Past Billing</h2>
          {recentBatches.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing billed yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentBatches.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/admin/clients/${client.id}/billing/${b.id}`}
                    className="card flex items-center justify-between transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
                  >
                    <span className="text-sm text-gray-700">
                      BS #{b.bsNumber} · {fmtDate(b.batchDate)} · {b.tripCount} trip(s)
                    </span>
                    <span className="text-sm text-brand-700">View / Download →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
