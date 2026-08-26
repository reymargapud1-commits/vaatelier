import { randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  courses,
  modules,
  lessons,
  quizzes,
  lessonProgress,
  quizAttempts,
  certificates,
  liveSessionBookings,
} from "@/db/schema";

/**
 * A user earns a Certificate of Completion once they have:
 *   1. Marked every lesson in the course as completed,
 *   2. Passed every module quiz at least once, AND
 *   3. Booked their required live training session with the coach.
 * (Attendance at the live session can't be verified automatically, so
 * booking it - which is the part the student controls - is the gate.)
 * If eligible and no certificate exists yet, one is created.
 */
export async function checkAndIssueCertificate(userId: string, courseId: string) {
  const [existing] = await db
    .select()
    .from(certificates)
    .where(and(eq(certificates.userId, userId), eq(certificates.courseId, courseId)))
    .limit(1);
  if (existing) return existing;

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) return null;

  const courseModules = await db.select().from(modules).where(eq(modules.courseId, courseId));
  const moduleIds = courseModules.map((m) => m.id);
  if (moduleIds.length === 0) return null;

  const allLessons = await db.select().from(lessons).where(inArray(lessons.moduleId, moduleIds));
  const allLessonIds = allLessons.map((l) => l.id);

  if (allLessonIds.length > 0) {
    const completed = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, userId),
          inArray(lessonProgress.lessonId, allLessonIds),
          eq(lessonProgress.completed, true)
        )
      );
    if (completed.length < allLessonIds.length) return null;
  }

  const courseQuizzes = await db.select().from(quizzes).where(inArray(quizzes.moduleId, moduleIds));
  for (const quiz of courseQuizzes) {
    const [passedAttempt] = await db
      .select()
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.userId, userId),
          eq(quizAttempts.quizId, quiz.id),
          eq(quizAttempts.passed, true)
        )
      )
      .limit(1);
    if (!passedAttempt) return null;
  }

  const [booking] = await db
    .select()
    .from(liveSessionBookings)
    .where(and(eq(liveSessionBookings.userId, userId), eq(liveSessionBookings.courseId, courseId)))
    .limit(1);
  if (!booking) return null;

  const id = randomUUID();
  await db.insert(certificates).values({ id, userId, courseId });
  const [created] = await db.select().from(certificates).where(eq(certificates.id, id)).limit(1);
  return created;
}
