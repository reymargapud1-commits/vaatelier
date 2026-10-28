import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { personalClients, fleetVehicles } from "@/db/schema";
import { computeDueStatus, listPmsRecords } from "@/lib/fleet-pms";
import Navbar from "@/components/Navbar";

function fmtDateInput(d: Date | null): string | undefined {
  if (!d) return undefined;
  return new Date(d).toISOString().slice(0, 10);
}

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "—";
}

export default async function TruckDetailPage({
  params,
}: {
  params: { clientId: string; truckId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "admin") redirect("/dashboard");

  const [client] = await db.select().from(personalClients).where(eq(personalClients.id, params.clientId)).limit(1);
  if (!client) notFound();

  const [vehicle] = await db.select().from(fleetVehicles).where(eq(fleetVehicles.id, params.truckId)).limit(1);
  if (!vehicle || vehicle.personalClientId !== client.id) notFound();

  const records = await listPmsRecords(vehicle.id);
  const status = computeDueStatus(records);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <Link href={`/admin/clients/${client.id}`} className="mb-4 inline-block text-sm text-brand-700 hover:underline">
          ← Back to {client.name}
        </Link>

        <div className="card mb-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {vehicle.plateNumber}
                {vehicle.truckName && <span className="font-normal text-gray-500"> ({vehicle.truckName})</span>}
              </h1>
              <p className="text-sm text-gray-500">{client.name}</p>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row">
              <a
                href={`/api/admin/trucks/${vehicle.id}/pms-report`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary whitespace-nowrap"
              >
                Download PMS History Report
              </a>
              <a
                href={`/api/admin/trucks/${vehicle.id}/pms-checklist`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary whitespace-nowrap"
              >
                Print PMS Checklist
              </a>
            </div>
          </div>

          <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${status.overdue ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
            {status.neverServiced
              ? "No completed PMS on record yet."
              : `Last PMS: ${fmtDate(status.lastCompleted!.pmsDate)} — Next due: ${fmtDate(status.nextDueDate)}${
                  status.overdue ? " — OVERDUE" : ""
                }`}
          </div>

          <dl className="mt-4 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
            {vehicle.location && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-400">Location</dt>
                <dd>{vehicle.location}</dd>
              </div>
            )}
            {vehicle.status && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-400">Status</dt>
                <dd>{vehicle.status}</dd>
              </div>
            )}
            {vehicle.dateAcquired && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-400">Date Acquired</dt>
                <dd>{fmtDate(vehicle.dateAcquired)}</dd>
              </div>
            )}
            {vehicle.registrationDate && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-400">Registration Date</dt>
                <dd>{fmtDate(vehicle.registrationDate)}</dd>
              </div>
            )}
          </dl>

          <details className="mt-4 group">
            <summary className="cursor-pointer text-sm font-medium text-brand-700 marker:content-none">
              <span className="mr-1 inline-block transition group-open:rotate-90">▶</span>
              Edit truck details
            </summary>
            <form
              action={`/api/admin/trucks/${vehicle.id}/update`}
              method="POST"
              className="mt-4 space-y-3 border-t border-gray-100 pt-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Plate No.</label>
                  <input name="plateNumber" required defaultValue={vehicle.plateNumber} className="input" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Truck Name</label>
                  <input name="truckName" defaultValue={vehicle.truckName} className="input" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Date Acquired</label>
                  <input name="dateAcquired" type="date" defaultValue={fmtDateInput(vehicle.dateAcquired)} className="input" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Registration Date</label>
                  <input
                    name="registrationDate"
                    type="date"
                    defaultValue={fmtDateInput(vehicle.registrationDate)}
                    className="input"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Location</label>
                  <input name="location" defaultValue={vehicle.location} className="input" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Status/Remarks</label>
                  <input name="status" defaultValue={vehicle.status} className="input" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" name="active" defaultChecked={vehicle.active} />
                Active
              </label>
              <div className="flex items-center gap-3">
                <button type="submit" className="btn-secondary">
                  Save Changes
                </button>
                <form action={`/api/admin/trucks/${vehicle.id}/delete`} method="POST" className="inline">
                  <button
                    type="submit"
                    className="text-sm text-red-600 hover:underline"
                    title="Delete this truck and all its PMS records"
                  >
                    Delete Truck
                  </button>
                </form>
              </div>
            </form>
          </details>
        </div>

        <div className="card mb-8">
          <h2 className="mb-3 font-bold text-gray-900">Add a PMS Record</h2>
          <p className="mb-4 text-sm text-gray-500">
            Leave Plan Odo / Actual Odo / Mileage blank for a planned (not-yet-done) slot - fill them in once the
            PMS is actually done. You can backfill past records too.
          </p>
          <form action={`/api/admin/trucks/${vehicle.id}/pms-records`} method="POST" className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
                <input name="pmsDate" type="date" required className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Plan Odo</label>
                <input name="planOdo" type="number" min="0" className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Actual Odo</label>
                <input name="actualOdo" type="number" min="0" className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Mileage</label>
                <input name="mileage" type="number" min="0" className="input" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Remarks</label>
                <input name="remarks" className="input" placeholder="e.g. Done PMS / For PM Schedule" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Person In Charge</label>
                <input name="personInCharge" className="input" />
              </div>
            </div>
            <button type="submit" className="btn-primary">
              Add Record
            </button>
          </form>
        </div>

        <div>
          <h2 className="mb-3 font-bold text-gray-900">PMS History</h2>
          {records.length === 0 ? (
            <p className="text-sm text-gray-500">No PMS records yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Plan Odo</th>
                    <th className="px-4 py-3 font-medium">Actual Odo</th>
                    <th className="px-4 py-3 font-medium">Mileage</th>
                    <th className="px-4 py-3 font-medium">Remarks</th>
                    <th className="px-4 py-3 font-medium">Person In Charge</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 text-gray-700">{fmtDate(r.pmsDate)}</td>
                      <td className="px-4 py-3 text-gray-700">{r.planOdo != null ? r.planOdo.toLocaleString("en-PH") : "—"}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {r.actualOdo != null ? r.actualOdo.toLocaleString("en-PH") : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{r.mileage != null ? r.mileage.toLocaleString("en-PH") : "—"}</td>
                      <td className="px-4 py-3 text-gray-700">{r.remarks || "—"}</td>
                      <td className="px-4 py-3 text-gray-700">{r.personInCharge || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <form action={`/api/admin/trucks/${vehicle.id}/pms-records/${r.id}/delete`} method="POST">
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
      </main>
    </>
  );
}
