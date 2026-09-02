import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { personalClients, personalClientCustomers, billingBatches } from "@/db/schema";
import Navbar from "@/components/Navbar";

export default async function ClientDetailPage({ params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "admin") redirect("/dashboard");

  const [client] = await db.select().from(personalClients).where(eq(personalClients.id, params.clientId)).limit(1);
  if (!client) notFound();

  const customers = await db
    .select()
    .from(personalClientCustomers)
    .where(eq(personalClientCustomers.personalClientId, client.id));

  const batches = await db
    .select()
    .from(billingBatches)
    .where(eq(billingBatches.personalClientId, client.id))
    .orderBy(desc(billingBatches.batchDate));

  const customerNameById = new Map(customers.map((c) => [c.id, c.name]));

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <Link href="/admin/clients" className="mb-4 inline-block text-sm text-brand-700 hover:underline">
          ← Back to My Services
        </Link>

        <div className="card mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
              <p className="text-sm text-gray-500">{client.industry || "—"}</p>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p>Commission: ₱{client.commissionRatePerTrip.toFixed(2)} / trip</p>
              <p>Next invoice #: VA-{String(client.nextInvoiceNumber).padStart(4, "0")}</p>
            </div>
          </div>
          <dl className="mt-4 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
            {client.businessAddress && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-400">Address</dt>
                <dd>{client.businessAddress}</dd>
              </div>
            )}
            {client.email && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-400">Email</dt>
                <dd>{client.email}</dd>
              </div>
            )}
            {client.tin && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-400">TIN</dt>
                <dd>{client.tin}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">Prepared by</dt>
              <dd>{client.preparedByName ? `${client.preparedByName} (${client.preparedByTitle})` : "—"}</dd>
            </div>
          </dl>

          <details className="mt-4 group">
            <summary className="cursor-pointer text-sm font-medium text-brand-700 marker:content-none">
              <span className="mr-1 inline-block transition group-open:rotate-90">▶</span>
              Edit client details
            </summary>
            <form action={`/api/admin/clients/${client.id}`} method="POST" className="mt-4 space-y-3 border-t border-gray-100 pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Client / Company Name</label>
                  <input name="name" defaultValue={client.name} required className="input" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Industry</label>
                  <input name="industry" defaultValue={client.industry} className="input" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Business Address</label>
                <input name="businessAddress" defaultValue={client.businessAddress} className="input" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                  <input name="email" defaultValue={client.email} className="input" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">TIN</label>
                  <input name="tin" defaultValue={client.tin} className="input" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Commission per trip (₱)</label>
                  <input
                    name="commissionRatePerTrip"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={client.commissionRatePerTrip}
                    className="input"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Next invoice number</label>
                  <input
                    name="nextInvoiceNumber"
                    type="number"
                    min="1"
                    defaultValue={client.nextInvoiceNumber}
                    className="input"
                  />
                </div>
              </div>
              <p className="pt-1 text-xs uppercase tracking-wide text-gray-400">
                &quot;Prepared by&quot; name shown on their billing statement (with a blank line above it for you to
                sign in person)
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Prepared by - Name</label>
                  <input name="preparedByName" defaultValue={client.preparedByName} className="input" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Prepared by - Title</label>
                  <input name="preparedByTitle" defaultValue={client.preparedByTitle} className="input" />
                </div>
              </div>
              <button type="submit" className="btn-secondary">
                Save Changes
              </button>
            </form>
          </details>
        </div>

        <div className="mb-8">
          <h2 className="mb-3 font-bold text-gray-900">Customers Monitored</h2>
          <div className="space-y-3">
            {customers.length === 0 && <p className="text-sm text-gray-500">No customers yet - add one below.</p>}
            {customers.map((c) => (
              <Link
                key={c.id}
                href={`/admin/clients/${client.id}/customers/${c.id}`}
                className="card flex items-center justify-between transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
              >
                <div>
                  <p className="font-semibold text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-500">Next billing statement #: {String(c.nextBsNumber).padStart(4, "0")}</p>
                </div>
                <span className="text-sm text-brand-700">Monitor deliveries →</span>
              </Link>
            ))}
          </div>

          <form action={`/api/admin/clients/${client.id}/customers`} method="POST" className="card mt-4 flex flex-wrap items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">Add a customer</label>
              <input name="name" required className="input" placeholder="e.g. Paintplas Corporation" />
            </div>
            <button type="submit" className="btn-primary">
              Add Customer
            </button>
          </form>
        </div>

        <div>
          <h2 className="mb-3 font-bold text-gray-900">Billing History</h2>
          {batches.length === 0 ? (
            <p className="text-sm text-gray-500">No billing generated yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">BS #</th>
                    <th className="px-4 py-3 font-medium">Invoice #</th>
                    <th className="px-4 py-3 font-medium">Trips</th>
                    <th className="px-4 py-3 font-medium">Billed to Customer</th>
                    <th className="px-4 py-3 font-medium">Your Commission</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {batches.map((b) => (
                    <tr key={b.id}>
                      <td className="px-4 py-3 text-gray-700">{new Date(b.batchDate).toLocaleDateString("en-PH")}</td>
                      <td className="px-4 py-3 text-gray-700">{customerNameById.get(b.customerId) || "—"}</td>
                      <td className="px-4 py-3 text-gray-700">{b.bsNumber}</td>
                      <td className="px-4 py-3 text-gray-700">{b.invoiceNumber}</td>
                      <td className="px-4 py-3 text-gray-700">{b.tripCount}</td>
                      <td className="px-4 py-3 text-gray-700">₱{b.totalToCustomer.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-gray-700">₱{b.commissionTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/clients/${client.id}/billing/${b.id}`} className="text-brand-700 hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
