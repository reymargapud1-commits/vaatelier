import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { fleetVehicles, personalClients } from "@/db/schema";
import { generateFleetPmsChecklistPdf } from "@/lib/fleet-pdf";

/** Admin-only: generates the printable PMS Monitoring Checklist PDF for one truck (Triton-form letterhead, 25-item inspection list, blank for hand-filling at the visit). */
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

  try {
    const pdfBytes = await generateFleetPmsChecklistPdf({ client, vehicle, generatedAt: new Date() });

    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="PMS-Checklist-${vehicle.plateNumber}.pdf"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (err) {
    console.error(`[fleet pms checklist] Failed to generate PDF for truck ${params.truckId}:`, err);
    return new NextResponse("Something went wrong generating this checklist. Please try again.", { status: 500 });
  }
}
