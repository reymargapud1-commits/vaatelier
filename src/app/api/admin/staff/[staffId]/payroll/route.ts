import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { and, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, staffProfiles, staffPayrollRuns } from "@/db/schema";
import { getPayPeriodByKey, computeGrossPay } from "@/lib/staff-payroll";
import { redirectUrl } from "@/lib/redirect-url";

/**
 * Admin-only: generates one semi-monthly payroll run for one staff member.
 * Days present x the staff member's CURRENT daily rate = gross pay (both
 * frozen onto the new row so a later rate change never rewrites an
 * already-issued payslip). The cash advance deduction for this run is
 * always typed in by hand here - see db/schema.ts's module comment on
 * staffPayrollRuns for why this is never auto-computed from the cash
 * advance ledger.
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
  const [profile] = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, params.staffId)).limit(1);
  if (!profile) {
    return new NextResponse("This staff member has no profile set up yet.", { status: 400 });
  }

  const form = await req.formData();
  const periodKey = String(form.get("periodKey") || "");
  const deductionPesos = Number(form.get("cashAdvanceDeduction") || 0);
  const deductionNote = String(form.get("deductionNote") || "").trim();

  const period = getPayPeriodByKey(periodKey);
  if (!period) {
    return new NextResponse("Invalid pay period.", { status: 400 });
  }
  if (deductionPesos < 0) {
    return new NextResponse("Deduction can't be negative.", { status: 400 });
  }

  const [existingRun] = await db
    .select()
    .from(staffPayrollRuns)
    .where(and(eq(staffPayrollRuns.userId, params.staffId), eq(staffPayrollRuns.periodKey, periodKey)))
    .limit(1);
  if (existingRun) {
    return new NextResponse(
      `Payroll for ${period.label} has already been generated for this staff member. Delete it first if you need to redo it.`,
      { status: 409 }
    );
  }

  const { daysPresent, grossPayCentavos } = await computeGrossPay(params.staffId, period, profile.dailyRateCentavos);
  const cashAdvanceDeductionCentavos = Math.round(deductionPesos * 100);
  const netPayCentavos = Math.max(0, grossPayCentavos - cashAdvanceDeductionCentavos);

  await db.insert(staffPayrollRuns).values({
    id: randomUUID(),
    userId: params.staffId,
    periodKey: period.key,
    periodLabel: period.label,
    periodStart: period.start,
    periodEnd: period.end,
    daysPresent,
    dailyRateCentavos: profile.dailyRateCentavos,
    grossPayCentavos,
    cashAdvanceDeductionCentavos,
    deductionNote,
    netPayCentavos,
  });

  return NextResponse.redirect(redirectUrl(req, `/admin/staff/${params.staffId}`), { status: 303 });
}
