import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { staffTimeEntries } from "@/db/schema";
import { redirectUrl } from "@/lib/redirect-url";

/** Admin-only: deletes a time entry (e.g. a duplicate, or a manual entry typed on the wrong day). */
export async function POST(req: Request, { params }: { params: { staffId: string; entryId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  await db
    .delete(staffTimeEntries)
    .where(and(eq(staffTimeEntries.id, params.entryId), eq(staffTimeEntries.userId, params.staffId)));

  return NextResponse.redirect(redirectUrl(req, `/admin/staff/${params.staffId}`), { status: 303 });
}
