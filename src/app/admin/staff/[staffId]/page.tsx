import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, staffProfiles, staffTimeEntries, staffCashAdvances, staffPayrollRuns } from "@/db/schema";
import Navbar from "@/components/Navbar";
import { listRecentPayPeriods, listPresentDates } from "@/lib/staff-payroll";

function peso(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

function fmtDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "2026-10-14" -> "Oct 14" for the little present-date chips. */
function fmtChip(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function AdminStaffDetailPage({ params }: { params: { staffId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "admin") redirect("/dashboard");

  const [staffUser] = await db.select().from(users).where(eq(users.id, params.staffId)).limit(1);
  if (!staffUser || staffUser.role !== "staff") notFound();

  const [profile] = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, params.staffId)).limit(1);

  const recentEntries = await db
    .select()
    .from(staffTimeEntries)
    .where(eq(staffTimeEntries.userId, params.staffId))
    .orderBy(desc(staffTimeEntries.clockIn))
    .limit(30);

  const cashAdvances = await db
    .select()
    .from(staffCashAdvances)
    .where(eq(staffCashAdvances.userId, params.staffId))
    .orderBy(desc(staffCashAdvances.dateGiven));
  const outstandingTotal = cashAdvances.filter((a) => !a.settled).reduce((sum, a) => sum + a.amountCentavos, 0);

  const payrollRuns = await db
    .select()
    .from(staffPayrollRuns)
    .where(eq(staffPayrollRuns.userId, params.staffId))
    .orderBy(desc(staffPayrollRuns.periodStart));
  const generatedPeriodKeys = new Set(payrollRuns.map((r) => r.periodKey));

  const candidatePeriods = listRecentPayPeriods(8).filter((p) => !generatedPeriodKeys.has(p.key));

  // Attendance log sheet, summarized by pay period - lets the admin see at a
  // glance which days are already logged (and spot gaps to fill in manually)
  // before generating payroll for that period.
  const recentPeriods = listRecentPayPeriods(4);
  const periodSummaries = await Promise.all(
    recentPeriods.map(async (p) => ({
      period: p,
      presentDates: await listPresentDates(params.staffId, p),
      payrollGenerated: generatedPeriodKeys.has(p.key),
    }))
  );

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <Link href="/admin/staff" className="mb-4 inline-block text-sm text-brand-700 hover:underline">
          ← Back to Staff
        </Link>
        <h1 className="mb-1 text-2xl font-bold text-gray-900">{staffUser.name}</h1>
        <p className="mb-8 text-sm text-gray-500">{staffUser.email}</p>

        {/* --- Profile --- */}
        <div className="card mb-8">
          <h2 className="mb-4 font-bold text-gray-900">Profile</h2>
          <form action={`/api/admin/staff/${staffUser.id}/update`} method="POST" className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Position</label>
                <input name="position" required defaultValue={profile?.position || "Virtual Assistant"} className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Daily Rate (₱)</label>
                <input
                  name="dailyRate"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  defaultValue={profile ? profile.dailyRateCentavos / 100 : undefined}
                  className="input"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Start Date</label>
                <input
                  name="startDate"
                  type="date"
                  defaultValue={profile ? fmtDateInput(profile.startDate) : undefined}
                  className="input"
                />
              </div>
              <div className="flex items-end pb-2.5">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input type="checkbox" name="active" defaultChecked={profile?.active ?? true} />
                  Active
                </label>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Service Agreement</label>
              <textarea name="serviceAgreement" rows={5} defaultValue={profile?.serviceAgreement} className="input" />
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" className="btn-primary">
                Save Changes
              </button>
              <a
                href={`/api/staff/agreement/${staffUser.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-brand-700 hover:underline"
              >
                Download Agreement PDF
              </a>
            </div>
          </form>
        </div>

        {/* --- Attendance / Time Log --- */}
        <div className="card mb-8">
          <h2 className="mb-1 font-bold text-gray-900">Attendance</h2>
          <p className="mb-4 text-sm text-gray-500">
            Cutoff: the 11th-25th is paid on the 30th of that month; the 26th through the 10th of the next
            month is paid on the 15th of that next month.
          </p>

          {/* Log sheet summary, per period - catch missing days before generating payroll. */}
          <div className="mb-6 space-y-3">
            {periodSummaries.map(({ period, presentDates, payrollGenerated }) => (
              <div key={period.key} className="rounded-lg border border-gray-100 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">{period.label}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Payday {period.paydayLabel}</span>
                    {payrollGenerated && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Payroll generated
                      </span>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {presentDates.length} day(s) logged
                  {presentDates.length > 0 && ":"}
                </p>
                {presentDates.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {presentDates.map((d) => (
                      <span key={d} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                        {fmtChip(d)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Manual entry - for a day the staff member forgot to clock in/out. */}
          <form
            action={`/api/admin/staff/${staffUser.id}/time-entries`}
            method="POST"
            className="mb-6 space-y-3 border-t border-gray-100 pt-5"
          >
            <h3 className="text-sm font-semibold text-gray-900">Add a Manual Entry</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
                <input name="date" type="date" required defaultValue={fmtDateInput(new Date())} className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Clock In (optional)</label>
                <input name="clockInTime" type="time" defaultValue="09:00" className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Clock Out (optional)</label>
                <input name="clockOutTime" type="time" defaultValue="18:00" className="input" />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Only the date matters for payroll - a day counts as "present" if it has at least one entry. The
              times above are just for the record.
            </p>
            <button type="submit" className="btn-secondary">
              Add Entry
            </button>
          </form>

          {/* Raw log, most recent first. */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Full Log</h3>
            {recentEntries.length === 0 ? (
              <p className="text-sm text-gray-500">No time entries yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Clock In</th>
                      <th className="px-4 py-3 font-medium">Clock Out</th>
                      <th className="px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentEntries.map((e) => (
                      <tr key={e.id}>
                        <td className="px-4 py-3 text-gray-700">
                          {e.clockIn.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" })}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {e.clockIn.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {e.clockOut
                            ? e.clockOut.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" })
                            : <span className="text-brand-600">Still clocked in</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <form action={`/api/admin/staff/${staffUser.id}/time-entries/${e.id}/delete`} method="POST">
                            <button type="submit" className="text-xs text-red-600 hover:underline">
                              Delete
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* --- Payroll --- */}
        <div className="card mb-8">
          <h2 className="mb-4 font-bold text-gray-900">Generate Payroll</h2>
          {!profile ? (
            <p className="text-sm text-gray-500">Set up this staff member's daily rate above first.</p>
          ) : candidatePeriods.length === 0 ? (
            <p className="text-sm text-gray-500">Every recent pay period has already been generated.</p>
          ) : (
            <form action={`/api/admin/staff/${staffUser.id}/payroll`} method="POST" className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Pay Period</label>
                  <select name="periodKey" required className="input">
                    {candidatePeriods.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label} (Payday {p.paydayLabel})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Cash Advance Deduction (₱) - type the amount to deduct this period
                  </label>
                  <input name="cashAdvanceDeduction" type="number" step="0.01" min="0" defaultValue="0" className="input" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Deduction Note (optional)</label>
                <input name="deductionNote" className="input" placeholder="e.g. Partial deduction for Oct 10 advance" />
              </div>
              {outstandingTotal > 0 && (
                <p className="text-xs text-amber-700">
                  Outstanding cash advances on record: {peso(outstandingTotal)}
                </p>
              )}
              <p className="text-xs text-gray-500">
                Days present and gross pay are computed automatically from the attendance log above, using the
                current daily rate ({peso(profile.dailyRateCentavos)}).
              </p>
              <button type="submit" className="btn-primary">
                Generate Payroll
              </button>
            </form>
          )}

          {payrollRuns.length > 0 && (
            <div className="mt-6 space-y-2 border-t border-gray-100 pt-5">
              {payrollRuns.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{r.periodLabel}</p>
                    <p className="text-xs text-gray-500">
                      {r.daysPresent} day(s) · Gross {peso(r.grossPayCentavos)}
                      {r.cashAdvanceDeductionCentavos > 0 && <> · Deduction {peso(r.cashAdvanceDeductionCentavos)}</>}
                      {" · "}
                      <span className="font-semibold text-gray-700">Net {peso(r.netPayCentavos)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 whitespace-nowrap">
                    <a
                      href={`/api/staff/payslip/${r.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-brand-700 hover:underline"
                    >
                      Download
                    </a>
                    <form action={`/api/admin/staff/${staffUser.id}/payroll/${r.id}/delete`} method="POST">
                      <button type="submit" className="text-sm text-red-600 hover:underline">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* --- Cash Advances --- */}
        <div className="card">
          <h2 className="mb-4 font-bold text-gray-900">Cash Advances</h2>
          <form action={`/api/admin/staff/${staffUser.id}/cash-advances`} method="POST" className="mb-5 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Amount (₱)</label>
                <input name="amount" type="number" step="0.01" min="0" required className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Date Given</label>
                <input name="dateGiven" type="date" defaultValue={fmtDateInput(new Date())} className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Note</label>
                <input name="note" className="input" placeholder="Optional" />
              </div>
            </div>
            <button type="submit" className="btn-secondary">
              Log Cash Advance
            </button>
          </form>

          {cashAdvances.length === 0 ? (
            <p className="text-sm text-gray-500">No cash advances on record.</p>
          ) : (
            <div className="space-y-2">
              {cashAdvances.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {peso(a.amountCentavos)}{" "}
                      <span className="font-normal text-gray-500">
                        · {a.dateGiven.toLocaleDateString("en-PH", { dateStyle: "medium" })}
                      </span>
                    </p>
                    {a.note && <p className="text-xs text-gray-500">{a.note}</p>}
                  </div>
                  <form action={`/api/admin/staff/${staffUser.id}/cash-advances/${a.id}/toggle`} method="POST">
                    <button
                      type="submit"
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        a.settled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {a.settled ? "Settled" : "Outstanding"} · toggle
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
