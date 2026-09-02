import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { personalClientCustomers, deliveryTrips } from "@/db/schema";

/** Logs one delivery/trip for a personal client's customer (the monitoring table). */
export async function POST(req: Request, { params }: { params: { customerId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const [customer] = await db
    .select()
    .from(personalClientCustomers)
    .where(eq(personalClientCustomers.id, params.customerId))
    .limit(1);
  if (!customer) {
    return new NextResponse("Customer not found", { status: 404 });
  }

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

  await db.insert(deliveryTrips).values({
    id: randomUUID(),
    customerId: customer.id,
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
  });

  return NextResponse.redirect(
    new URL(`/admin/clients/${customer.personalClientId}/customers/${customer.id}`, req.url),
    { status: 303 }
  );
}
