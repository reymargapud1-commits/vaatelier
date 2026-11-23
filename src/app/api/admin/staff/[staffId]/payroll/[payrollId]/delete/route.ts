import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { staffPayrollRuns } from "@/db/schema";
import { redirectUrl } from "@/lib/redirect-url";

/** Admin-only: deletes a payroll run (e.g. it was generated with a mistake) so it can be redone for that period. */
export async function POST(req: Request, { params }: { params: { staffId: string; payrollId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  await db
    .delete(staffPayrollRuns)
    .where(and(eq(staffPayrollRuns.id, params.payrollId), eq(staffPayrollRuns.userId, params.staffId)));

  return NextResponse.redirect(redirectUrl(req, `/admin/staff/${params.staffId}`), { status: 303 });
}
