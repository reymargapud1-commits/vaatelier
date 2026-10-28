import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { fleetVehicles, fleetPmsRecords } from "@/db/schema";
import { redirectUrl } from "@/lib/redirect-url";

/** Admin-only: removes a truck (e.g. added by mistake) and its PMS record history. */
export async function POST(req: Request, { params }: { params: { truckId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const [vehicle] = await db.select().from(fleetVehicles).where(eq(fleetVehicles.id, params.truckId)).limit(1);
  if (!vehicle) {
    return new NextResponse("Truck not found", { status: 404 });
  }

  await db.delete(fleetPmsRecords).where(eq(fleetPmsRecords.vehicleId, params.truckId));
  await db.delete(fleetVehicles).where(eq(fleetVehicles.id, params.truckId));

  return NextResponse.redirect(redirectUrl(req, `/admin/clients/${vehicle.personalClientId}`), { status: 303 });
}
