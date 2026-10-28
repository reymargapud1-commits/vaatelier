import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { fleetVehicles } from "@/db/schema";
import { redirectUrl } from "@/lib/redirect-url";

/** Admin-only: edits a truck's masterlist info (plate, name, acquisition/registration dates, location, status, active flag). */
export async function POST(req: Request, { params }: { params: { truckId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const [vehicle] = await db.select().from(fleetVehicles).where(eq(fleetVehicles.id, params.truckId)).limit(1);
  if (!vehicle) {
    return new NextResponse("Truck not found", { status: 404 });
  }

  const form = await req.formData();
  const plateNumber = String(form.get("plateNumber") || "").trim().toUpperCase();
  const truckName = String(form.get("truckName") || "").trim();
  const dateAcquiredRaw = String(form.get("dateAcquired") || "");
  const registrationDateRaw = String(form.get("registrationDate") || "");
  const location = String(form.get("location") || "").trim();
  const status = String(form.get("status") || "").trim();
  const active = form.get("active") === "on";

  if (!plateNumber) {
    return new NextResponse("Plate number is required", { status: 400 });
  }

  await db
    .update(fleetVehicles)
    .set({
      plateNumber,
      truckName,
      dateAcquired: dateAcquiredRaw ? new Date(dateAcquiredRaw) : null,
      registrationDate: registrationDateRaw ? new Date(registrationDateRaw) : null,
      location,
      status,
      active,
    })
    .where(eq(fleetVehicles.id, params.truckId));

  return NextResponse.redirect(
    redirectUrl(req, `/admin/clients/${vehicle.personalClientId}/trucks/${params.truckId}`),
    { status: 303 }
  );
}
