import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, staffProfiles } from "@/db/schema";
import { redirectUrl } from "@/lib/redirect-url";

/**
 * Admin-only: onboards a new staff member - creates their login (users row,
 * role: "staff") and their employment profile (staffProfiles) in one go.
 * Unlike students, staff accounts are never self-registered - only an admin
 * creates them, since this is the business owner adding an employee.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const form = await req.formData();
  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").toLowerCase().trim();
  const password = String(form.get("password") || "");
  const position = String(form.get("position") || "Virtual Assistant").trim() || "Virtual Assistant";
  const dailyRatePesos = Number(form.get("dailyRate") || 0);
  const startDateRaw = String(form.get("startDate") || "");
  const serviceAgreement = String(form.get("serviceAgreement") || "").trim();

  if (!name || !email || !password) {
    return new NextResponse("Name, email, and password are required.", { status: 400 });
  }
  if (password.length < 8) {
    return new NextResponse("Password must be at least 8 characters.", { status: 400 });
  }
  if (!dailyRatePesos || dailyRatePesos <= 0) {
    return new NextResponse("Please enter a valid daily rate.", { status: 400 });
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return new NextResponse("An account already uses this email.", { status: 409 });
  }

  const startDate = startDateRaw ? new Date(startDateRaw) : new Date();

  const userId = randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({
    id: userId,
    name,
    email,
    passwordHash,
    role: "staff",
  });

  await db.insert(staffProfiles).values({
    id: randomUUID(),
    userId,
    position,
    dailyRateCentavos: Math.round(dailyRatePesos * 100),
    startDate,
    serviceAgreement,
  });

  return NextResponse.redirect(redirectUrl(req, `/admin/staff/${userId}`), { status: 303 });
}
