import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { staffTimeEntries } from "@/db/schema";
import Navbar from "@/components/Navbar";

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export default async function StaffTimeclockPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "staff") redirect("/dashboard");

  const userId = (session.user as any).id;
  const entries = await db
    .select()
    .from(staffTimeEntries)
    .where(eq(staffTimeEntries.userId, userId))
    .orderBy(desc(staffTimeEntries.clockIn));

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <Link href="/staff" className="mb-4 inline-block text-sm text-brand-700 hover:underline">
          ← Back to Dashboard
        </Link>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Time Log</h1>
        <p className="mb-8 text-sm text-gray-600">Every clock-in and clock-out, most recent first.</p>

        {entries.length === 0 ? (
          <p className="text-sm text-gray-500">No time entries yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Clock In</th>
                  <th className="px-4 py-3 font-medium">Clock Out</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 text-gray-700">
                      {e.clockIn.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" })}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {e.clockIn.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {e.clockOut ? (
                        e.clockOut.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" })
                      ) : (
                        <span className="text-brand-600">Still clocked in</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {e.clockOut ? formatDuration(e.clockOut.getTime() - e.clockIn.getTime()) : "—"}
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
