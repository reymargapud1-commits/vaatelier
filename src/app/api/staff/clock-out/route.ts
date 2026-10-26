import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, desc, eq, isNull } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { staffTimeEntries } from "@/db/schema";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "staff") {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  const userId = (session.user as any).id;

  const [openEntry] = await db
    .select()
    .from(staffTimeEntries)
    .where(and(eq(staffTimeEntries.userId, userId), isNull(staffTimeEntries.clockOut)))
    .orderBy(desc(staffTimeEntries.clockIn))
    .limit(1);
  if (!openEntry) {
    return NextResponse.json({ error: "You're not clocked in right now." }, { status: 400 });
  }

  await db.update(staffTimeEntries).set({ clockOut: new Date() }).where(eq(staffTimeEntries.id, openEntry.id));

  return NextResponse.json({ ok: true });
}
