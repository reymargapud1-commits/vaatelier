import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { deliveryTrips, personalClientCustomers } from "@/db/schema";

/**
 * Removes an unbilled delivery entry (a mis-logged trip). Trips that are
 * already part of a billing batch can't be removed here - that would
 * silently change a document that's already been generated/sent.
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
    return new NextResponse("This delivery is already part of a generated billing statement and can't be removed", {
      status: 400,
    });
  }

  const [customer] = await db
    .select()
    .from(personalClientCustomers)
    .where(eq(personalClientCustomers.id, trip.customerId))
    .limit(1);

  await db.delete(deliveryTrips).where(eq(deliveryTrips.id, trip.id));

  return NextResponse.redirect(
    new URL(`/admin/clients/${customer?.personalClientId}/customers/${trip.customerId}`, req.url),
    { status: 303 }
  );
}
