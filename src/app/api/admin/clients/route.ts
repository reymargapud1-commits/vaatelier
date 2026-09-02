import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { personalClients } from "@/db/schema";

/**
 * Creates a new personal client (Admin > My Services). A plain HTML <form>
 * POST, same as everywhere else in the admin tools - no JS required.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const form = await req.formData();
  const name = String(form.get("name") || "").trim();
  if (!name) {
    return new NextResponse("Client name is required", { status: 400 });
  }

  const id = randomUUID();
  await db.insert(personalClients).values({
    id,
    name,
    industry: String(form.get("industry") || "").trim(),
    businessAddress: String(form.get("businessAddress") || "").trim(),
    email: String(form.get("email") || "").trim(),
    tin: String(form.get("tin") || "").trim(),
    commissionRatePerTrip: Number(form.get("commissionRatePerTrip") || 500),
  });

  return NextResponse.redirect(new URL(`/admin/clients/${id}`, req.url), { status: 303 });
}
