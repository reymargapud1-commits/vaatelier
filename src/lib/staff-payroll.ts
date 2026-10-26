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

function daysInMonth(year: number, month: number): number {
  // Day 0 of next month = last day of this month.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthShortName(month: number): string {
  return new Date(Date.UTC(2000, month - 1, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

export interface PayPeriod {
  /** e.g. "2026-08-A" (1st-15th) or "2026-08-B" (16th-end) - stable, sortable, unique per staff member. */
  key: string;
  /** e.g. "Aug 1-15, 2026" */
  label: string;
  /** Inclusive start, Asia/Manila midnight. */
  start: Date;
  /** EXCLUSIVE end (Asia/Manila midnight of the first day after the period). */
  end: Date;
}

function buildPeriod(year: number, month: number, half: "A" | "B"): PayPeriod {
  if (half === "A") {
    return {
      key: `${year}-${String(month).padStart(2, "0")}-A`,
      label: `${monthShortName(month)} 1-15, ${year}`,
      start: manilaMidnightUTC(year, month, 1),
      end: manilaMidnightUTC(year, month, 16),
    };
  }

  const lastDay = daysInMonth(year, month);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return {
    key: `${year}-${String(month).padStart(2, "0")}-B`,
    label: `${monthShortName(month)} 16-${lastDay}, ${year}`,
    start: manilaMidnightUTC(year, month, 16),
    end: manilaMidnightUTC(nextYear, nextMonth, 1),
  };
}

/** The semi-monthly pay period that contains the given instant (default now), in Asia/Manila calendar terms. */
export function getPayPeriodFor(date: Date = new Date()): PayPeriod {
  const { year, month, day } = manilaDateParts(date);
  return buildPeriod(year, month, day <= 15 ? "A" : "B");
}

/** Recent pay periods, most recent first (including the current one), for an admin's period picker. */
export function listRecentPayPeriods(count: number = 8, from: Date = new Date()): PayPeriod[] {
  const { year, month, day } = manilaDateParts(from);
  let y = year;
  let m = month;
  let half: "A" | "B" = day <= 15 ? "A" : "B";

  const periods: PayPeriod[] = [];
  for (let i = 0; i < count; i++) {
    periods.push(buildPeriod(y, m, half));
    if (half === "B") {
      half = "A";
    } else {
      half = "B";
      m -= 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
    }
  }
  return periods;
}

/** Parses a period key like "2026-08-A" back into a full PayPeriod, or null if malformed. */
export function getPayPeriodByKey(key: string): PayPeriod | null {
  const match = /^(\d{4})-(\d{2})-([AB])$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return buildPeriod(year, month, match[3] as "A" | "B");
}

/** Number of distinct Asia/Manila calendar days with at least one clock-in inside [period.start, period.end). */
export async function computeDaysPresent(userId: string, period: { start: Date; end: Date }): Promise<number> {
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
      return `${year}-${month}-${day}`;
    })
  );
  return days.size;
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
