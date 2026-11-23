import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { personalClients, fleetVehicles } from "@/db/schema";
import { redirectUrl } from "@/lib/redirect-url";

/** Adds a truck/shuttle to a personal client's fleet (e.g. a JJTS Enterprises plate for PMS monitoring). */
export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const [client] = await db.select().from(personalClients).where(eq(personalClients.id, params.clientId)).limit(1);
  if (!client) {
    return new NextResponse("Client not found", { status: 404 });
  }

  const form = await req.formData();
  const plateNumber = String(form.get("plateNumber") || "").trim().toUpperCase();
  const truckName = String(form.get("truckName") || "").trim();
  const dateAcquiredRaw = String(form.get("dateAcquired") || "");
  const registrationDateRaw = String(form.get("registrationDate") || "");
  const location = String(form.get("location") || "").trim();
  const status = String(form.get("status") || "").trim();

  if (!plateNumber) {
    return new NextResponse("Plate number is required", { status: 400 });
  }

  const id = randomUUID();
  await db.insert(fleetVehicles).values({
    id,
    personalClientId: client.id,
    plateNumber,
    truckName,
    dateAcquired: dateAcquiredRaw ? new Date(dateAcquiredRaw) : null,
    registrationDate: registrationDateRaw ? new Date(registrationDateRaw) : null,
    location,
    status,
  });

  return NextResponse.redirect(redirectUrl(req, `/admin/clients/${client.id}`), { status: 303 });
}
