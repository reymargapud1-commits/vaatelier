import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, storeOrders } from "@/db/schema";
import Navbar from "@/components/Navbar";
import OrderStatusControl from "@/components/OrderStatusControl";

export default async function AdminStoreOrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "admin") redirect("/dashboard");

  const orders = await db
    .select({
      id: storeOrders.id,
      itemLabel: storeOrders.itemLabel,
      amountCentavos: storeOrders.amountCentavos,
      customerNote: storeOrders.customerNote,
      status: storeOrders.status,
      createdAt: storeOrders.createdAt,
      studentName: users.name,
      studentEmail: users.email,
    })
    .from(storeOrders)
    .innerJoin(users, eq(users.id, storeOrders.userId))
    .orderBy(desc(storeOrders.createdAt));

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">VA Document Store Orders</h1>

        {orders.length === 0 ? (
          <p className="text-gray-500">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Note</th>
                  <th className="px-4 py-3 font-medium">Ordered</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{o.studentName}</div>
                      <div className="text-xs text-gray-500">{o.studentEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{o.itemLabel}</td>
                    <td className="px-4 py-3 text-gray-700">
                      ₱{(o.amountCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-gray-600">{o.customerNote || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {o.createdAt.toLocaleDateString("en-PH", { dateStyle: "medium" } as any)}
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusControl orderId={o.id} currentStatus={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
