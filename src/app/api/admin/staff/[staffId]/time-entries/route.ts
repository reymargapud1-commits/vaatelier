import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, staffTimeEntries } from "@/db/schema";
import { manilaDateTimeToUTC } from "@/lib/staff-payroll";
import { redirectUrl } from "@/lib/redirect-url";

/**
 * Admin-only: manually logs a time entry for a staff member, for a day they
 * forgot to clock in/out (or any backdated correction). Only the calendar
 * date actually matters for payroll - computeDaysPresent only counts
 * distinct Asia/Manila days with at least one entry - so clock-in/out times
 * default to a plain 9:00 AM-6:00 PM workday when the admin doesn't type
 * specific ones.
 */
export async function POST(req: Request, { params }: { params: { staffId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const [staffUser] = await db.select().from(users).where(eq(users.id, params.staffId)).limit(1);
  if (!staffUser || staffUser.role !== "staff") {
    return new NextResponse("Staff member not found", { status: 404 });
  }

  const form = await req.formData();
  const date = String(form.get("date") || "");
  const clockInTime = String(form.get("clockInTime") || "09:00");
  const clockOutTime = String(form.get("clockOutTime") || "18:00");

  const clockIn = manilaDateTimeToUTC(date, clockInTime);
  if (!clockIn) {
    return new NextResponse("Please pick a valid date.", { status: 400 });
  }
  const clockOutParsed = manilaDateTimeToUTC(date, clockOutTime);
  const clockOut = clockOutParsed && clockOutParsed > clockIn ? clockOutParsed : null;

  await db.insert(staffTimeEntries).values({
    id: randomUUID(),
    userId: params.staffId,
    clockIn,
    clockOut,
  });

  return NextResponse.redirect(redirectUrl(req, `/admin/staff/${params.staffId}`), { status: 303 });
}
