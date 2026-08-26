import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { liveSessionBookings } from "@/db/schema";

export async function PATCH(req: Request, { params }: { params: { bookingId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { status } = (await req.json()) as { status: string };
  if (!["requested", "confirmed", "completed", "cancelled"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  await db.update(liveSessionBookings).set({ status }).where(eq(liveSessionBookings.id, params.bookingId));
  return NextResponse.json({ success: true });
}
