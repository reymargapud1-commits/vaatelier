import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, staffProfiles } from "@/db/schema";
import { generateServiceAgreementPdf } from "@/lib/staff-pdf";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { staffId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const sessionUserId = (session.user as any).id;
  const isAdmin = (session.user as any).role === "admin";
  if (params.staffId !== sessionUserId && !isAdmin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const [staffUser] = await db.select().from(users).where(eq(users.id, params.staffId)).limit(1);
  if (!staffUser || staffUser.role !== "staff") {
    return new NextResponse("Staff member not found", { status: 404 });
  }
  const [profile] = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, params.staffId)).limit(1);
  if (!profile) {
    return new NextResponse("No staff profile found for this account", { status: 404 });
  }

  const coachName = process.env.COACH_NAME || "Reymar Gapud";
  const coachTitle = process.env.COACH_TITLE || "VA Coach & Trainer";

  try {
    const pdfBytes = await generateServiceAgreementPdf({
      staffName: staffUser.name,
      position: profile.position,
      dailyRateCentavos: profile.dailyRateCentavos,
      startDate: profile.startDate,
      agreementText: profile.serviceAgreement,
      coachName,
      coachTitle,
    });

    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Service-Agreement-${staffUser.name.replace(/\s+/g, "-")}.pdf"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (err) {
    console.error(`[agreement] Failed to generate PDF for ${params.staffId}:`, err);
    return new NextResponse("Something went wrong generating this agreement. Please try again.", { status: 500 });
  }
}
