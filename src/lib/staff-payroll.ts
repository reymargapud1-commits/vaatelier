import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { staffTimeEntries } from "@/db/schema";

// Philippine Standard Time is a fixed UTC+8 offset with no daylight saving,
// so pay-period boundaries (and "which calendar day was this clock-in on")
// can be computed without a timezone library.
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** The UTC instant that corresponds to local Asia/Manila midnight on year-month-day (month is 1-indexed). */
function manilaMidnightUTC(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - MANILA_OFFSET_MS);
}

/** Breaks a UTC instant down into its Asia/Manila calendar date. */
function manilaDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}

/**
 * Turns an admin-picked Asia/Manila local date + time (for a manual time
 * entry) into the UTC instant we store. Returns null on a malformed date.
 */
export function manilaDateTimeToUTC(dateStr: string, timeStr: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || "");
  if (!dateMatch) return null;
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(timeStr || "");
  const hh = timeMatch ? Number(timeMatch[1]) : 9;
  const mm = timeMatch ? Number(timeMatch[2]) : 0;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  return new Date(Date.UTC(year, month - 1, day, hh, mm, 0) - MANILA_OFFSET_MS);
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of next month = last day of this month.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthShortName(month: number): string {
  return new Date(Date.UTC(2000, month - 1, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

export interface PayPeriod {
  /**
   * e.g. "2026-10-11" (the Oct 11-25 cutoff) or "2026-10-26" (the Oct 26 -
   * Nov 10 cutoff) - stable, sortable, unique per staff member. The trailing
   * number is the Asia/Manila calendar day the period STARTS on.
   */
  key: string;
  /** e.g. "Oct 11-25, 2026" */
  label: string;
  /** Inclusive start, Asia/Manila midnight. */
  start: Date;
  /** EXCLUSIVE end (Asia/Manila midnight of the first day after the period). */
  end: Date;
  /** The Asia/Manila calendar date staff actually gets paid for this period. */
  payday: Date;
  /** e.g. "Oct 30, 2026" - payday formatted for display. */
  paydayLabel: string;
}

/**
 * Cutoff: the 11th-25th of a month is paid on the 30th of that SAME month
 * (or the month's last day, for Feb); the 26th of a month through the 10th
 * of the next month is paid on the 15th of that NEXT month. This is the
 * coach's actual cutoff, not a plain calendar half - see the Aug 2026
 * conversation that replaced the original 1-15 / 16-end design.
 */
function buildPeriod(year: number, month: number, startDay: 11 | 26): PayPeriod {
  if (startDay === 11) {
    const paydayDay = Math.min(30, daysInMonth(year, month));
    const payday = manilaMidnightUTC(year, month, paydayDay);
    return {
      key: `${year}-${String(month).padStart(2, "0")}-11`,
      label: `${monthShortName(month)} 11-25, ${year}`,
      start: manilaMidnightUTC(year, month, 11),
      end: manilaMidnightUTC(year, month, 26),
      payday,
      paydayLabel: `${monthShortName(month)} ${paydayDay}, ${year}`,
    };
  }

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const payday = manilaMidnightUTC(nextYear, nextMonth, 15);
  const label =
    year === nextYear
      ? `${monthShortName(month)} 26 - ${monthShortName(nextMonth)} 10, ${year}`
      : `${monthShortName(month)} 26, ${year} - ${monthShortName(nextMonth)} 10, ${nextYear}`;
  return {
    key: `${year}-${String(month).padStart(2, "0")}-26`,
    label,
    start: manilaMidnightUTC(year, month, 26),
    end: manilaMidnightUTC(nextYear, nextMonth, 11),
    payday,
    paydayLabel: `${monthShortName(nextMonth)} 15, ${nextYear}`,
  };
}

/** The pay period that contains the given instant (default now), in Asia/Manila calendar terms. */
export function getPayPeriodFor(date: Date = new Date()): PayPeriod {
  const { year, month, day } = manilaDateParts(date);
  if (day >= 11 && day <= 25) return buildPeriod(year, month, 11);
  if (day >= 26) return buildPeriod(year, month, 26);

  // day 1-10 falls inside the period that STARTED on the 26th of the
  // previous month.
  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }
  return buildPeriod(prevYear, prevMonth, 26);
}

/** Recent pay periods, most recent first (including the current one), for an admin's period picker. */
export function listRecentPayPeriods(count: number = 8, from: Date = new Date()): PayPeriod[] {
  const { year, month, day } = manilaDateParts(from);
  let y = year;
  let m = month;
  let startDay: 11 | 26 = day >= 11 && day <= 25 ? 11 : 26;
  if (day >= 1 && day <= 10) {
    // Currently inside the period that started on the 26th of last month.
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }

  const periods: PayPeriod[] = [];
  for (let i = 0; i < count; i++) {
    periods.push(buildPeriod(y, m, startDay));
    if (startDay === 26) {
      startDay = 11;
    } else {
      startDay = 26;
      m -= 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
    }
  }
  return periods;
}

/** Parses a period key like "2026-10-11" back into a full PayPeriod, or null if malformed. */
export function getPayPeriodByKey(key: string): PayPeriod | null {
  const match = /^(\d{4})-(\d{2})-(11|26)$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return buildPeriod(year, month, Number(match[3]) as 11 | 26);
}

/** Sorted "YYYY-MM-DD" (Asia/Manila) calendar dates with at least one clock-in inside [period.start, period.end). */
export async function listPresentDates(userId: string, period: { start: Date; end: Date }): Promise<string[]> {
  const entries = await db
    .select()
    .from(staffTimeEntries)
    .where(
      and(
        eq(staffTimeEntries.userId, userId),
        gte(staffTimeEntries.clockIn, period.start),
        lt(staffTimeEntries.clockIn, period.end)
      )
    );

  const days = new Set(
    entries.map((e) => {
      const { year, month, day } = manilaDateParts(e.clockIn);
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    })
  );
  return Array.from(days).sort();
}

/** Number of distinct Asia/Manila calendar days with at least one clock-in inside [period.start, period.end). */
export async function computeDaysPresent(userId: string, period: { start: Date; end: Date }): Promise<number> {
  const dates = await listPresentDates(userId, period);
  return dates.length;
}

/** Days present x daily rate - the gross pay for one staff member's pay period, before any deduction. */
export async function computeGrossPay(
  userId: string,
  period: { start: Date; end: Date },
  dailyRateCentavos: number
): Promise<{ daysPresent: number; grossPayCentavos: number }> {
  const daysPresent = await computeDaysPresent(userId, period);
  return { daysPresent, grossPayCentavos: daysPresent * dailyRateCentavos };
}
