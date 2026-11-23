import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { storeOrders } from "@/db/schema";

export async function PATCH(req: Request, { params }: { params: { orderId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { status } = (await req.json()) as { status: string };
  if (!["pending_payment", "paid", "in_progress", "delivered", "cancelled"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  await db.update(storeOrders).set({ status, updatedAt: new Date() }).where(eq(storeOrders.id, params.orderId));
  return NextResponse.json({ success: true });
}
