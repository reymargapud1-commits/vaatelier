import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { staffCashAdvances } from "@/db/schema";
import { redirectUrl } from "@/lib/redirect-url";

/** Admin-only: flips a cash advance between settled/outstanding - a manual tracking flag, nothing is computed from it. */
export async function POST(req: Request, { params }: { params: { staffId: string; advanceId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const [advance] = await db
    .select()
    .from(staffCashAdvances)
    .where(and(eq(staffCashAdvances.id, params.advanceId), eq(staffCashAdvances.userId, params.staffId)))
    .limit(1);
  if (!advance) {
    return new NextResponse("Cash advance not found", { status: 404 });
  }

  await db
    .update(staffCashAdvances)
    .set({ settled: !advance.settled })
    .where(eq(staffCashAdvances.id, advance.id));

  return NextResponse.redirect(redirectUrl(req, `/admin/staff/${params.staffId}`), { status: 303 });
}
