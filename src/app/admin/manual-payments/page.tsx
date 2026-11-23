import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, payments, liveSessionBookings, storeOrders } from "@/db/schema";
import Navbar from "@/components/Navbar";
import ManualPaymentReviewControl from "@/components/ManualPaymentReviewControl";

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    pending_review: "bg-amber-50 text-amber-700",
    paid: "bg-emerald-50 text-emerald-700",
    rejected: "bg-red-50 text-red-700",
    awaiting_proof: "bg-gray-100 text-gray-600",
  };
  const labels: Record<string, string> = {
    pending_review: "Pending Review",
    paid: "Approved",
    rejected: "Rejected",
    awaiting_proof: "Awaiting Proof",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-600"}`}>
      {labels[status] || status}
    </span>
  );
}

export default async function AdminManualPaymentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "admin") redirect("/dashboard");

  const rows = await db
    .select({
      id: payments.id,
      status: payments.status,
      amountCentavos: payments.amountCentavos,
      purpose: payments.purpose,
      referenceId: payments.referenceId,
      note: payments.note,
      proofImagePath: payments.proofImagePath,
      createdAt: payments.createdAt,
      studentName: users.name,
      studentEmail: users.email,
    })
    .from(payments)
    .innerJoin(users, eq(users.id, payments.userId))
    .where(eq(payments.provider, "manual_gcash"))
    .orderBy(desc(payments.createdAt));

  const bookingIds = rows
    .filter((r) => r.purpose === "coaching" && r.referenceId)
    .map((r) => r.referenceId as string);
  const orderIds = rows
    .filter((r) => r.purpose === "store_order" && r.referenceId)
    .map((r) => r.referenceId as string);

  const bookings = bookingIds.length
    ? await db
        .select({ id: liveSessionBookings.id, scheduledAt: liveSessionBookings.scheduledAt })
        .from(liveSessionBookings)
        .where(inArray(liveSessionBookings.id, bookingIds))
    : [];
  const orders = orderIds.length
    ? await db
        .select({ id: storeOrders.id, itemLabel: storeOrders.itemLabel })
        .from(storeOrders)
        .where(inArray(storeOrders.id, orderIds))
    : [];

  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const orderById = new Map(orders.map((o) => [o.id, o]));

  function contextFor(row: (typeof rows)[number]) {
    if (row.purpose === "coaching") {
      const b = row.referenceId ? bookingById.get(row.referenceId) : undefined;
      return b
        ? `Coaching session · ${b.scheduledAt.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" })}`
        : "Coaching session";
    }
    if (row.purpose === "store_order") {
      const o = row.referenceId ? orderById.get(row.referenceId) : undefined;
      return o ? `Store order · ${o.itemLabel}` : "Store order";
    }
    return "Enrollment";
  }

  const pending = rows.filter((r) => r.status === "pending_review");
  const history = rows.filter((r) => r.status !== "pending_review");

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Manual GCash Payments</h1>
        <p className="mb-8 text-sm text-gray-600">
          Students who paid you directly via GCash upload a screenshot here. Check the amount and
          reference against your GCash app, then approve or reject.
        </p>

        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          Awaiting Review {pending.length > 0 && `(${pending.length})`}
        </h2>
        {pending.length === 0 ? (
          <p className="mb-10 text-sm text-gray-500">Nothing waiting on you right now.</p>
        ) : (
          <div className="mb-10 space-y-4">
            {pending.map((row) => (
              <div key={row.id} className="card flex flex-col gap-4 sm:flex-row sm:items-start">
                <a
                  href={`/api/payment-proof/${row.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/payment-proof/${row.id}`}
                    alt="Payment proof screenshot"
                    className="h-32 w-32 rounded-lg border border-gray-200 object-cover"
                  />
                </a>
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{row.studentName}</span>
                    <span className="text-xs text-gray-500">{row.studentEmail}</span>
                  </div>
                  <p className="mb-1 text-sm text-gray-700">{contextFor(row)}</p>
                  <p className="mb-1 text-lg font-bold text-gray-900">
                    ₱{(row.amountCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </p>
                  {row.note && (
                    <p className="mb-1 text-sm text-gray-600">
                      <span className="font-medium">Note:</span> {row.note}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    Submitted{" "}
                    {row.createdAt.toLocaleString("en-PH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Manila",
                    })}
                  </p>
                </div>
                <div className="shrink-0">
                  <ManualPaymentReviewControl paymentId={row.id} />
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 className="mb-3 text-lg font-semibold text-gray-900">History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">No reviewed payments yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">For</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{row.studentName}</div>
                      <div className="text-xs text-gray-500">{row.studentEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{contextFor(row)}</td>
                    <td className="px-4 py-3 text-gray-700">
                      ₱{(row.amountCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">{statusBadge(row.status)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {row.createdAt.toLocaleDateString("en-PH", {
                        dateStyle: "medium",
                        timeZone: "Asia/Manila",
                      })}
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
