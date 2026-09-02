import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { personalClients, personalClientCustomers } from "@/db/schema";

/**
 * Adds a customer (an end-customer of a personal client, e.g. Paintplas
 * Corporation under 5RJSL) whose deliveries will be monitored/billed.
 */
export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const [client] = await db.select().from(personalClients).where(eq(personalClients.id, params.clientId)).limit(1);
  if (!client) {
    return new NextResponse("Client not found", { status: 404 });
  }

  const form = await req.formData();
  const name = String(form.get("name") || "").trim();
  if (!name) {
    return new NextResponse("Customer name is required", { status: 400 });
  }

  const id = randomUUID();
  await db.insert(personalClientCustomers).values({
    id,
    personalClientId: client.id,
    name,
  });

  return NextResponse.redirect(new URL(`/admin/clients/${client.id}`, req.url), { status: 303 });
}
