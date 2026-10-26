import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, staffProfiles } from "@/db/schema";
import { redirectUrl } from "@/lib/redirect-url";

/** Admin-only: edits a staff member's name, position, daily rate, start date, service agreement text, and active status. */
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
  const name = String(form.get("name") || "").trim();
  const position = String(form.get("position") || "Virtual Assistant").trim() || "Virtual Assistant";
  const dailyRatePesos = Number(form.get("dailyRate") || 0);
  const startDateRaw = String(form.get("startDate") || "");
  const serviceAgreement = String(form.get("serviceAgreement") || "").trim();
  const active = form.get("active") === "on";

  if (!name) {
    return new NextResponse("Please enter the staff member's name.", { status: 400 });
  }
  if (!dailyRatePesos || dailyRatePesos <= 0) {
    return new NextResponse("Please enter a valid daily rate.", { status: 400 });
  }

  await db.update(users).set({ name }).where(eq(users.id, params.staffId));

  await db
    .update(staffProfiles)
    .set({
      position,
      dailyRateCentavos: Math.round(dailyRatePesos * 100),
      startDate: startDateRaw ? new Date(startDateRaw) : new Date(),
      serviceAgreement,
      active,
    })
    .where(eq(staffProfiles.userId, params.staffId));

  return NextResponse.redirect(redirectUrl(req, `/admin/staff/${params.staffId}`), { status: 303 });
}
