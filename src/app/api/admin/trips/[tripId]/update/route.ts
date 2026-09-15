import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { deliveryTrips, personalClientCustomers } from "@/db/schema";

/**
 * Edits an unbilled delivery entry in place (fix a typo, correct an amount,
 * etc.) instead of having to remove it and re-add it from scratch. Same
 * fields and validation as logging a new delivery. Trips that are already
 * part of a billing batch can't be edited here - that would silently change
 * a document that's already been generated/sent.
 */
export async function POST(req: Request, { params }: { params: { tripId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const [trip] = await db.select().from(deliveryTrips).where(eq(deliveryTrips.id, params.tripId)).limit(1);
  if (!trip) {
    return new NextResponse("Delivery not found", { status: 404 });
  }
  if (trip.billingBatchId) {
    return new NextResponse("This delivery is already part of a generated billing statement and can't be edited", {
      status: 400,
    });
  }

  const [customer] = await db
    .select()
    .from(personalClientCustomers)
    .where(eq(personalClientCustomers.id, trip.customerId))
    .limit(1);

  const form = await req.formData();
  const tripDateStr = String(form.get("tripDate") || "");
  const plateNumber = String(form.get("plateNumber") || "").trim();
  const driverName = String(form.get("driverName") || "").trim();
  const routeFrom = String(form.get("routeFrom") || "").trim();
  const routeTo = String(form.get("routeTo") || "").trim();
  const amountRateRaw = form.get("amountRate");

  if (!tripDateStr || !plateNumber || !driverName || !routeFrom || !routeTo || amountRateRaw === null) {
    return new NextResponse("Date, plate #, driver, route, and amount are required", { status: 400 });
  }

  const tripDate = new Date(`${tripDateStr}T00:00:00`);
  if (isNaN(tripDate.getTime())) {
    return new NextResponse("Invalid date", { status: 400 });
  }

  const amountRate = Number(amountRateRaw);
  if (isNaN(amountRate) || amountRate < 0) {
    return new NextResponse("Invalid amount", { status: 400 });
  }

  await db
    .update(deliveryTrips)
    .set({
      tripDate,
      plateNumber,
      driverName,
      helper1Name: String(form.get("helper1Name") || "").trim(),
      helper2Name: String(form.get("helper2Name") || "").trim(),
      routeFrom,
      routeTo,
      gatePassNumber: String(form.get("gatePassNumber") || "").trim(),
      drSiNumber: String(form.get("drSiNumber") || "").trim(),
      waybillNumber: String(form.get("waybillNumber") || "").trim(),
      remarks: String(form.get("remarks") || "").trim(),
      amountRate,
    })
    .where(eq(deliveryTrips.id, trip.id));

  return NextResponse.redirect(
    new URL(`/admin/clients/${customer?.personalClientId}/customers/${trip.customerId}`, req.url),
    { status: 303 }
  );
}
