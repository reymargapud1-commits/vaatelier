import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, courses } from "@/db/schema";
import niches from "../../../../../content/niches.json";

/**
 * Sets the logged-in student's training niche (users.courseId) - the one
 * choice a student makes right after enrolling, before any lesson unlocks.
 * A student can only pick once: courseId being non-null already means they
 * picked before, so this refuses to change it (there's no "switch niches"
 * flow yet - see README "Training niches" for why).
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.isPaid) {
    return NextResponse.json({ error: "Payment required" }, { status: 402 });
  }
  if (user.courseId) {
    return NextResponse.json({ error: "You've already chosen a training niche" }, { status: 400 });
  }

  const { courseId } = (await req.json()) as { courseId: string };

  const niche = niches.niches.find((n) => n.courseId === courseId && n.isPublished);
  if (!niche) {
    return NextResponse.json({ error: "Unknown or unavailable training niche" }, { status: 400 });
  }

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) {
    return NextResponse.json({ error: "This niche's content isn't seeded yet" }, { status: 400 });
  }

  await db.update(users).set({ courseId }).where(eq(users.id, userId));

  return NextResponse.json({ success: true, courseId });
}
