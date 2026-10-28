import { eq } from "drizzle-orm";
import { db } from "@/db";
import { fleetPmsRecords } from "@/db/schema";

// JJTS/Triton's own target cadence (per Reymar, Oct 2026): every truck
// should get a PMS every 4 calendar months. The original paper form's
// Notes section instead keys PMS off odometer intervals (+10,000 km for a
// delivery truck, +7,500 km for a shuttle service) - that note is kept,
// verbatim, on the printed report (see lib/fleet-pdf.ts) since it's part
// of Triton's own form, but the 4-month calendar rule below is what this
// app actually uses to flag a truck as due/overdue, since that's the
// catch-up schedule Reymar is actually managing to.
export const PMS_INTERVAL_MONTHS = 4;

export type FleetPmsRecord = typeof fleetPmsRecords.$inferSelect;

/** A record only counts as a completed PMS (not just a planned slot) once it has both an odometer reading and a date. */
export function isCompletedPms(record: FleetPmsRecord): boolean {
  return record.actualOdo != null && record.pmsDate != null;
}

/**
 * Adds `months` calendar months to `date`, clamping the day to the target
 * month's last day for short months (e.g. Jan 31 + 1 month -> Feb 28/29,
 * never rolling into March) - same clamp approach as
 * staff-payroll.ts's payday calculation.
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const day = date.getUTCDate();
  const targetMonthFirst = new Date(Date.UTC(y, m + months, 1));
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetMonthFirst.getUTCFullYear(), targetMonthFirst.getUTCMonth() + 1, 0)
  ).getUTCDate();
  return new Date(
    Date.UTC(targetMonthFirst.getUTCFullYear(), targetMonthFirst.getUTCMonth(), Math.min(day, lastDayOfTargetMonth))
  );
}

export interface PmsDueStatus {
  lastCompleted: FleetPmsRecord | null;
  nextDueDate: Date | null;
  overdue: boolean;
  neverServiced: boolean;
}

/** Among a truck's PMS records (any order), finds the most recent completed one and derives its due status. */
export function computeDueStatus(records: FleetPmsRecord[], asOf: Date = new Date()): PmsDueStatus {
  const completed = records.filter(isCompletedPms).sort((a, b) => b.pmsDate!.getTime() - a.pmsDate!.getTime());
  const lastCompleted = completed[0] || null;

  if (!lastCompleted) {
    return { lastCompleted: null, nextDueDate: null, overdue: true, neverServiced: true };
  }

  const nextDueDate = addMonthsClamped(lastCompleted.pmsDate!, PMS_INTERVAL_MONTHS);
  return { lastCompleted, nextDueDate, overdue: asOf.getTime() > nextDueDate.getTime(), neverServiced: false };
}

/** All PMS records for a truck, most recent date first (records with no date yet sort last). */
export async function listPmsRecords(vehicleId: string): Promise<FleetPmsRecord[]> {
  const rows = await db.select().from(fleetPmsRecords).where(eq(fleetPmsRecords.vehicleId, vehicleId));
  return rows.sort((a, b) => {
    if (a.pmsDate && b.pmsDate) return b.pmsDate.getTime() - a.pmsDate.getTime();
    if (a.pmsDate) return -1;
    if (b.pmsDate) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}
