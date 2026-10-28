import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { fleetVehicles, fleetPmsRecords } from "@/db/schema";
import { redirectUrl } from "@/lib/redirect-url";

/**
 * Adds one PMS record for a truck - a planned slot, a completed PMS, or
 * both at once, entered by hand by the admin (including backfilled
 * historical entries - see lib/fleet-pms.ts). Every field but the date is
 * optional, so a record can represent "planned for this date" with no
 * odometer reading yet.
 */
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
  const pmsDateRaw = String(form.get("pmsDate") || "");
  const planOdoRaw = String(form.get("planOdo") || "").trim();
  const actualOdoRaw = String(form.get("actualOdo") || "").trim();
  const mileageRaw = String(form.get("mileage") || "").trim();
  const remarks = String(form.get("remarks") || "").trim();
  const personInCharge = String(form.get("personInCharge") || "").trim();

  if (!pmsDateRaw) {
    return new NextResponse("Date is required", { status: 400 });
  }

  const id = randomUUID();
  await db.insert(fleetPmsRecords).values({
    id,
    vehicleId: params.truckId,
    planOdo: planOdoRaw ? Number(planOdoRaw) : null,
    actualOdo: actualOdoRaw ? Number(actualOdoRaw) : null,
    mileage: mileageRaw ? Number(mileageRaw) : null,
    pmsDate: new Date(pmsDateRaw),
    remarks,
    personInCharge,
  });

  return NextResponse.redirect(
    redirectUrl(req, `/admin/clients/${vehicle.personalClientId}/trucks/${params.truckId}`),
    { status: 303 }
  );
}
