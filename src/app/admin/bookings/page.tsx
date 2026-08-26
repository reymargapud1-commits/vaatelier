import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, liveSessionBookings } from "@/db/schema";
import Navbar from "@/components/Navbar";
import BookingStatusControl from "@/components/BookingStatusControl";

export default async function AdminBookingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "admin") redirect("/dashboard");

  const bookings = await db
    .select({
      id: liveSessionBookings.id,
      scheduledAt: liveSessionBookings.scheduledAt,
      studentNote: liveSessionBookings.studentNote,
      status: liveSessionBookings.status,
      paymentStatus: liveSessionBookings.paymentStatus,
      amountCentavos: liveSessionBookings.amountCentavos,
      createdAt: liveSessionBookings.createdAt,
      studentName: users.name,
      studentEmail: users.email,
    })
    .from(liveSessionBookings)
    .innerJoin(users, eq(users.id, liveSessionBookings.userId))
    .orderBy(desc(liveSessionBookings.scheduledAt));

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Live Training Session Bookings</h1>

        {bookings.length === 0 ? (
          <p className="text-gray-500">No sessions booked yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Scheduled (Manila)</th>
                  <th className="px-4 py-3 font-medium">Note</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Calendar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{b.studentName}</div>
                      <div className="text-xs text-gray-500">{b.studentEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {b.scheduledAt.toLocaleString("en-PH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Manila",
                      })}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-gray-600">{b.studentNote || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          b.paymentStatus === "paid"
                            ? "bg-emerald-50 text-emerald-700"
                            : b.paymentStatus === "pending"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {b.paymentStatus === "paid"
                          ? `Paid ₱${(b.amountCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                          : b.paymentStatus === "pending"
                            ? "Pending"
                            : "Unpaid"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <BookingStatusControl bookingId={b.id} currentStatus={b.status} />
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`/api/booking/ics/${b.id}`}
                        className="text-brand-700 hover:underline"
                      >
                        Download .ics
                      </a>
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
