import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, staffProfiles, staffTimeEntries } from "@/db/schema";
import Navbar from "@/components/Navbar";
import TimeClockControl from "@/components/TimeClockControl";
import { getPayPeriodFor, computeDaysPresent } from "@/lib/staff-payroll";

export default async function StaffDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "staff") redirect("/dashboard");

  const userId = (session.user as any).id;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) redirect("/login");

  const [profile] = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, userId)).limit(1);

  const [openEntry] = await db
    .select()
    .from(staffTimeEntries)
    .where(and(eq(staffTimeEntries.userId, userId), isNull(staffTimeEntries.clockOut)))
    .orderBy(desc(staffTimeEntries.clockIn))
    .limit(1);

  const recentEntries = await db
    .select()
    .from(staffTimeEntries)
    .where(eq(staffTimeEntries.userId, userId))
    .orderBy(desc(staffTimeEntries.clockIn))
    .limit(5);

  const currentPeriod = getPayPeriodFor();
  const daysPresentThisPeriod = await computeDaysPresent(userId, currentPeriod);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Hi, {user.name.split(" ")[0]}!</h1>
          <p className="mt-1 text-gray-600">{profile?.position || "Virtual Assistant"} - The VA Atelier</p>
        </div>

        <div className="mb-6 grid gap-5 sm:grid-cols-2">
          <div className="card">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Time Clock</p>
            <p className="mb-4 text-sm text-gray-600">
              {openEntry
                ? `Clocked in at ${openEntry.clockIn.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" })}`
                : "You're not clocked in right now."}
            </p>
            <TimeClockControl clockedIn={!!openEntry} />
          </div>

          <div className="card">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">This Pay Period</p>
            <p className="mb-1 text-sm text-gray-600">{currentPeriod.label}</p>
            <p className="text-3xl font-extrabold text-gray-900">
              {daysPresentThisPeriod} <span className="text-base font-normal text-gray-400">day(s) present</span>
            </p>
          </div>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Link href="/staff/payslips" className="card text-center transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-2xl">💵</p>
            <p className="mt-2 font-semibold text-gray-900">Payslips</p>
          </Link>
          <Link href="/staff/cash-advances" className="card text-center transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-2xl">🧾</p>
            <p className="mt-2 font-semibold text-gray-900">Cash Advances</p>
          </Link>
          <Link href="/staff/agreement" className="card text-center transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-2xl">📄</p>
            <p className="mt-2 font-semibold text-gray-900">Service Agreement</p>
          </Link>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Recent Time Log</h2>
            <Link href="/staff/timeclock" className="text-sm text-brand-700 hover:underline">
              View all →
            </Link>
          </div>
          {recentEntries.length === 0 ? (
            <p className="text-sm text-gray-500">No time entries yet - clock in above to start tracking.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Clock In</th>
                    <th className="px-4 py-3 font-medium">Clock Out</th>
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
