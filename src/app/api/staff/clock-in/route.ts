import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { and, eq, isNull } from "drizzle-orm";
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
    .limit(1);
  if (openEntry) {
    return NextResponse.json({ error: "You're already clocked in." }, { status: 400 });
  }

  const id = randomUUID();
  await db.insert(staffTimeEntries).values({ id, userId, clockIn: new Date() });

  return NextResponse.json({ ok: true, id });
}
