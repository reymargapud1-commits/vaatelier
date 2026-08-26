import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, storeOrders } from "@/db/schema";
import Navbar from "@/components/Navbar";
import OrderForm from "@/components/OrderForm";
import { STORE_ITEMS } from "@/lib/store-items";

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Awaiting Payment",
  paid: "Paid — In Queue",
  in_progress: "Being Worked On",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<string, string> = {
  pending_payment: "bg-gray-100 text-gray-600",
  paid: "bg-amber-50 text-amber-700",
  in_progress: "bg-brand-50 text-brand-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-600",
};

export default async function StorePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) redirect("/login");
  if (!user.isPaid) redirect("/payment");

  const myOrders = await db
    .select()
    .from(storeOrders)
    .where(eq(storeOrders.userId, userId))
    .orderBy(desc(storeOrders.createdAt));

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Link href="/dashboard" className="mb-4 inline-block text-sm text-brand-700 hover:underline">
          ← Back to Dashboard
        </Link>

        <div className="mb-10 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-lg sm:p-8">
          <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            🛍️ VA Document Store
          </span>
          <h1 className="text-2xl font-bold sm:text-3xl">
            Job-Ready Materials, Made For You
          </h1>
          <p className="mt-2 max-w-2xl text-brand-100">
            Skip the guesswork. Coach Reymar personally puts together the exact application
            materials that get Filipino VAs hired — done for you, so you can start applying with
            confidence today.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {STORE_ITEMS.map((item) => (
            <OrderForm key={item.key} item={item} />
          ))}
        </div>

        {myOrders.length > 0 && (
          <div className="mt-12">
            <h2 className="mb-4 text-xl font-bold text-gray-900">My Orders</h2>
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Ordered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {myOrders.map((o) => (
                    <tr key={o.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">{o.itemLabel}</td>
                      <td className="px-4 py-3 text-gray-700">
                        ₱{(o.amountCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            STATUS_STYLES[o.status] || "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {STATUS_LABELS[o.status] || o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {o.createdAt.toLocaleDateString("en-PH", { dateStyle: "medium" } as any)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
