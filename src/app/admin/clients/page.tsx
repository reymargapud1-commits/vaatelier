import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { personalClients, personalClientCustomers } from "@/db/schema";
import Navbar from "@/components/Navbar";

/**
 * Admin-only "My Services" area: Reymar's own personal VA/agent clients
 * (e.g. 5RJSL Lanuza Logistics Corp.), entirely separate from the training
 * portal's students. See src/db/schema.ts for the personalClients /
 * personalClientCustomers / deliveryTrips / billingBatches tables and
 * src/lib/billing-pdf.ts for how the two generated documents are built.
 */
export default async function AdminClientsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "admin") redirect("/dashboard");

  const clients = await db.select().from(personalClients).orderBy(desc(personalClients.createdAt));
  const customers = await db.select().from(personalClientCustomers);
  const customersByClient = new Map<string, typeof customers>();
  for (const c of customers) {
    if (!customersByClient.has(c.personalClientId)) customersByClient.set(c.personalClientId, []);
    customersByClient.get(c.personalClientId)!.push(c);
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">My Services</h1>
        <p className="mb-8 text-sm text-gray-600">
          Your own personal VA/agent clients - separate from The VA Atelier's training students.
          Track deliveries, generate billing statements, and bill your own commission.
        </p>

        <div className="mb-10 space-y-4">
          {clients.length === 0 && <p className="text-gray-500">No clients yet - add your first one below.</p>}
          {clients.map((c) => (
            <Link
              key={c.id}
              href={`/admin/clients/${c.id}`}
              className="card block transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-gray-900">{c.name}</h2>
                  <p className="text-sm text-gray-500">{c.industry || "—"}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {(customersByClient.get(c.id) || []).length} customer(s) monitored
                  </p>
                </div>
                <span className="text-sm text-brand-700">View →</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="card">
          <h2 className="mb-4 font-bold text-gray-900">Add a Client</h2>
          <form action="/api/admin/clients" method="POST" className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Client / Company Name</label>
                <input name="name" required className="input" placeholder="e.g. 5RJSL Lanuza Logistics Corp." />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Industry</label>
                <input name="industry" className="input" placeholder="e.g. Trucking Services" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Business Address</label>
              <input name="businessAddress" className="input" placeholder="For their billing statement letterhead" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                <input name="email" className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">TIN (optional)</label>
                <input name="tin" className="input" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Your commission per trip (₱)
              </label>
              <input
                name="commissionRatePerTrip"
                type="number"
                step="0.01"
                min="0"
                defaultValue="500"
                required
                className="input max-w-xs"
              />
            </div>
            <button type="submit" className="btn-primary">
              Add Client
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
