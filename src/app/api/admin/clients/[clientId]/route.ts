import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { personalClients } from "@/db/schema";

/**
 * Updates a personal client's details (letterhead info, commission rate,
 * signatories, invoice numbering). Plain <form> POST from the "Edit client
 * details" panel on /admin/clients/[clientId].
 */
export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const form = await req.formData();
  const name = String(form.get("name") || "").trim();
  if (!name) {
    return new NextResponse("Client name is required", { status: 400 });
  }

  await db
    .update(personalClients)
    .set({
      name,
      industry: String(form.get("industry") || "").trim(),
      businessAddress: String(form.get("businessAddress") || "").trim(),
      email: String(form.get("email") || "").trim(),
      tin: String(form.get("tin") || "").trim(),
      commissionRatePerTrip: Number(form.get("commissionRatePerTrip") || 0),
      nextInvoiceNumber: Number(form.get("nextInvoiceNumber") || 1),
      preparedByName: String(form.get("preparedByName") || "").trim(),
      preparedByTitle: String(form.get("preparedByTitle") || "").trim(),
    })
    .where(eq(personalClients.id, params.clientId));

  return NextResponse.redirect(new URL(`/admin/clients/${params.clientId}`, req.url), { status: 303 });
}
