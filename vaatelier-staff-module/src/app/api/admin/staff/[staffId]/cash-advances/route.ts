import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, staffCashAdvances } from "@/db/schema";
import { redirectUrl } from "@/lib/redirect-url";

/**
 * Admin-only: logs a cash advance given to a staff member. This is just the
 * running ledger - it does NOT deduct anything from payroll automatically.
 * The actual deduction for a given pay period is always typed in by hand
 * when generating that period's payroll run (see .../payroll route).
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
  const amountPesos = Number(form.get("amount") || 0);
  const dateGivenRaw = String(form.get("dateGiven") || "");
  const note = String(form.get("note") || "").trim();

  if (!amountPesos || amountPesos <= 0) {
    return new NextResponse("Please enter a valid amount.", { status: 400 });
  }

  await db.insert(staffCashAdvances).values({
    id: randomUUID(),
    userId: params.staffId,
    amountCentavos: Math.round(amountPesos * 100),
    dateGiven: dateGivenRaw ? new Date(dateGivenRaw) : new Date(),
    note,
  });

  return NextResponse.redirect(redirectUrl(req, `/admin/staff/${params.staffId}`), { status: 303 });
}
