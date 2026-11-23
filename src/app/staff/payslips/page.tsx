import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { staffPayrollRuns } from "@/db/schema";
import Navbar from "@/components/Navbar";

function peso(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

export default async function StaffPayslipsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "staff") redirect("/dashboard");

  const userId = (session.user as any).id;
  const runs = await db
    .select()
    .from(staffPayrollRuns)
    .where(eq(staffPayrollRuns.userId, userId))
    .orderBy(desc(staffPayrollRuns.periodStart));

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <Link href="/staff" className="mb-4 inline-block text-sm text-brand-700 hover:underline">
          ← Back to Dashboard
        </Link>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">My Payslips</h1>
        <p className="mb-8 text-sm text-gray-600">Every pay period your admin has generated, most recent first.</p>

        {runs.length === 0 ? (
          <p className="text-sm text-gray-500">No payslips yet - they'll appear here once your admin generates payroll.</p>
        ) : (
          <div className="space-y-3">
            {runs.map((r) => (
              <div key={r.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-gray-900">{r.periodLabel}</p>
                  <p className="text-sm text-gray-500">
                    {r.daysPresent} day(s) present · Gross {peso(r.grossPayCentavos)}
                    {r.cashAdvanceDeductionCentavos > 0 && <> · Deduction {peso(r.cashAdvanceDeductionCentavos)}</>}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-xl font-extrabold text-gray-900">{peso(r.netPayCentavos)}</p>
                  <a
                    href={`/api/staff/payslip/${r.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary !px-3 !py-2 text-sm whitespace-nowrap"
                  >
                    Download PDF
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
