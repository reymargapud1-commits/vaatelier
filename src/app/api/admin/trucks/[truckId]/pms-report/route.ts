import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { fleetVehicles, fleetPmsRecords, personalClients } from "@/db/schema";
import { generateFleetPmsReportPdf } from "@/lib/fleet-pdf";

/** Admin-only: generates the printable PMS History Report PDF for one truck (Triton-form letterhead, full record history). */
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { truckId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const [vehicle] = await db.select().from(fleetVehicles).where(eq(fleetVehicles.id, params.truckId)).limit(1);
  if (!vehicle) {
    return new NextResponse("Truck not found", { status: 404 });
  }

  const [client] = await db
    .select()
    .from(personalClients)
    .where(eq(personalClients.id, vehicle.personalClientId))
    .limit(1);
  if (!client) {
    return new NextResponse("Client not found", { status: 404 });
  }

  const records = await db.select().from(fleetPmsRecords).where(eq(fleetPmsRecords.vehicleId, params.truckId));

  try {
    const pdfBytes = await generateFleetPmsReportPdf({ client, vehicle, records, generatedAt: new Date() });

    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="PMS-History-${vehicle.plateNumber}.pdf"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (err) {
    console.error(`[fleet pms report] Failed to generate PDF for truck ${params.truckId}:`, err);
    return new NextResponse("Something went wrong generating this report. Please try again.", { status: 500 });
  }
}
