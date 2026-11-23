import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { and, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, lessons, lessonProgress, modules } from "@/db/schema";

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

  const { lessonId } = await req.json();
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  // A lesson belongs to exactly one niche (via its module's courseId) - make
  // sure a student can only mark progress on their own niche's lessons.
  const [lessonModule] = await db.select().from(modules).where(eq(modules.id, lesson.moduleId)).limit(1);
  if (!lessonModule || lessonModule.courseId !== user.courseId) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const [existing] = await db
    .select()
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)))
    .limit(1);

  if (existing) {
    await db
      .update(lessonProgress)
      .set({ completed: true, completedAt: new Date() })
      .where(eq(lessonProgress.id, existing.id));
  } else {
    await db.insert(lessonProgress).values({
      id: randomUUID(),
      userId,
      lessonId,
      completed: true,
      completedAt: new Date(),
    });
  }

  return NextResponse.json({ success: true });
}
