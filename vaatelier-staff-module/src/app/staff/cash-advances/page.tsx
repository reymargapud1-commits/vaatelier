import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { staffCashAdvances } from "@/db/schema";
import Navbar from "@/components/Navbar";

function peso(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

export default async function StaffCashAdvancesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "staff") redirect("/dashboard");

  const userId = (session.user as any).id;
  const advances = await db
    .select()
    .from(staffCashAdvances)
    .where(eq(staffCashAdvances.userId, userId))
    .orderBy(desc(staffCashAdvances.dateGiven));

  const outstandingTotal = advances.filter((a) => !a.settled).reduce((sum, a) => sum + a.amountCentavos, 0);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <Link href="/staff" className="mb-4 inline-block text-sm text-brand-700 hover:underline">
          ← Back to Dashboard
        </Link>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">My Cash Advances</h1>
        <p className="mb-6 text-sm text-gray-600">
          A record of cash advances from your admin. Any deduction from your pay shows up on that period's payslip.
        </p>

        {advances.length > 0 && (
          <div className="card mb-6 inline-block">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Outstanding</p>
            <p className="text-2xl font-extrabold text-gray-900">{peso(outstandingTotal)}</p>
          </div>
        )}

        {advances.length === 0 ? (
          <p className="text-sm text-gray-500">No cash advances on record.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Note</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {advances.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 text-gray-700">
                      {a.dateGiven.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" })}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{peso(a.amountCentavos)}</td>
                    <td className="px-4 py-3 text-gray-600">{a.note || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          a.settled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {a.settled ? "Settled" : "Outstanding"}
                      </span>
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
