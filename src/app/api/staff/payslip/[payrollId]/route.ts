import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, staffPayrollRuns, staffProfiles } from "@/db/schema";
import { generatePayslipPdf } from "@/lib/staff-pdf";
import { listPresentDates } from "@/lib/staff-payroll";

// Served to the staff member themselves (their own payslip) OR an admin
// (viewing/downloading any staff member's payslip from /admin/staff) - same
// dual-permission pattern as /api/payment-proof/[paymentId].
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { payrollId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const [payroll] = await db
    .select()
    .from(staffPayrollRuns)
    .where(eq(staffPayrollRuns.id, params.payrollId))
    .limit(1);
  if (!payroll) {
    return new NextResponse("Payslip not found", { status: 404 });
  }

  const sessionUserId = (session.user as any).id;
  const isAdmin = (session.user as any).role === "admin";
  if (payroll.userId !== sessionUserId && !isAdmin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const [staffUser] = await db.select().from(users).where(eq(users.id, payroll.userId)).limit(1);
  const [profile] = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, payroll.userId)).limit(1);
  if (!staffUser) {
    return new NextResponse("Staff member not found", { status: 404 });
  }

  const coachName = process.env.COACH_NAME || "Reymar Gapud";
  // A frozen payroll run only stores start/end + the day COUNT, not which
  // specific days - re-derive the list from the time log for display. If
  // entries were edited/deleted after this run was generated, the chips
  // shown here may no longer exactly match daysPresent; that's fine, this is
  // a display aid, not the source of truth for pay (the frozen numbers are).
  const presentDates = await listPresentDates(payroll.userId, { start: payroll.periodStart, end: payroll.periodEnd });

  try {
    const pdfBytes = await generatePayslipPdf({
      staffName: staffUser.name,
      position: profile?.position || "Virtual Assistant",
      periodLabel: payroll.periodLabel,
      daysPresent: payroll.daysPresent,
      dailyRateCentavos: payroll.dailyRateCentavos,
      grossPayCentavos: payroll.grossPayCentavos,
      cashAdvanceDeductionCentavos: payroll.cashAdvanceDeductionCentavos,
      deductionNote: payroll.deductionNote,
      netPayCentavos: payroll.netPayCentavos,
      payrollId: payroll.id,
      generatedAt: payroll.generatedAt,
      coachName,
      presentDates,
    });

    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Payslip-${payroll.periodKey}-${staffUser.name.replace(/\s+/g, "-")}.pdf"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (err) {
    console.error(`[payslip] Failed to generate PDF for ${payroll.id}:`, err);
    return new NextResponse("Something went wrong generating this payslip. Please try again.", { status: 500 });
  }
}
