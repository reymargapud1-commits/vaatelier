import { randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { courses, modules, lessons, quizzes, lessonProgress, quizAttempts, certificates } from "@/db/schema";
import { CERTIFICATE_TRACKS, getTrackById } from "@/lib/certificate-tracks";

/**
 * A student earns a track's Certificate once they have, for that track's
 * modules only:
 *   1. Marked every lesson as completed, AND
 *   2. Passed every module quiz at least once.
 * The 1-on-1 live coaching session is a separate, optional paid add-on and
 * is never required for a certificate. If eligible and no certificate for
 * this track exists yet, one is created.
 */
export async function checkAndIssueCertificate(userId: string, courseId: string, trackId: string) {
  const track = getTrackById(trackId);
  if (!track) return null;

  const [existing] = await db
    .select()
    .from(certificates)
    .where(and(eq(certificates.userId, userId), eq(certificates.courseId, courseId), eq(certificates.track, trackId)))
    .limit(1);
  if (existing) return existing;

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) return null;

  const trackModules = await db
    .select()
    .from(modules)
    .where(and(eq(modules.courseId, courseId), inArray(modules.id, track.moduleIds)));
  const moduleIds = trackModules.map((m) => m.id);
  if (moduleIds.length === 0) return null;

  const trackLessons = await db.select().from(lessons).where(inArray(lessons.moduleId, moduleIds));
  const trackLessonIds = trackLessons.map((l) => l.id);

  if (trackLessonIds.length > 0) {
    const completed = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, userId),
          inArray(lessonProgress.lessonId, trackLessonIds),
          eq(lessonProgress.completed, true)
        )
      );
    if (completed.length < trackLessonIds.length) return null;
  }

  const trackQuizzes = await db.select().from(quizzes).where(inArray(quizzes.moduleId, moduleIds));
  for (const quiz of trackQuizzes) {
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

  const id = randomUUID();
  await db.insert(certificates).values({ id, userId, courseId, track: trackId });
  const [created] = await db.select().from(certificates).where(eq(certificates.id, id)).limit(1);
  return created;
}

/**
 * Runs checkAndIssueCertificate for every track and returns whichever
 * newly qualified. Called after a quiz is passed, since passing one quiz
 * could complete more than one track's requirements (unlikely given the
 * current module split, but keeps this correct if tracks are ever resized).
 */
export async function checkAndIssueAllCertificates(userId: string, courseId: string) {
  const results = [];
  for (const track of CERTIFICATE_TRACKS) {
    const cert = await checkAndIssueCertificate(userId, courseId, track.id);
    if (cert) results.push(cert);
  }
  return results;
}

/**
 * Returns, for every track, whether the user has completed all lessons +
 * passed all quizzes in it (independent of whether a certificate row has
 * been issued yet - used to render progress/CTAs on the dashboard without
 * writing to the DB).
 */
export async function getTrackProgress(userId: string, courseId: string) {
  const allModules = await db.select().from(modules).where(eq(modules.courseId, courseId));
  const moduleById = new Map(allModules.map((m) => [m.id, m]));
  const allModuleIds = allModules.map((m) => m.id);

  const allLessons = allModuleIds.length
    ? await db.select().from(lessons).where(inArray(lessons.moduleId, allModuleIds))
    : [];
  const allQuizzes = allModuleIds.length
    ? await db.select().from(quizzes).where(inArray(quizzes.moduleId, allModuleIds))
    : [];

  const lessonIds = allLessons.map((l) => l.id);
  const completedLessonIds = new Set(
    lessonIds.length
      ? (
          await db
            .select()
            .from(lessonProgress)
            .where(
              and(
                eq(lessonProgress.userId, userId),
                inArray(lessonProgress.lessonId, lessonIds),
                eq(lessonProgress.completed, true)
              )
            )
        ).map((p) => p.lessonId)
      : []
  );

  const quizIds = allQuizzes.map((q) => q.id);
  const passedQuizIds = new Set(
    quizIds.length
      ? (
          await db
            .select()
            .from(quizAttempts)
            .where(
              and(
                eq(quizAttempts.userId, userId),
                inArray(quizAttempts.quizId, quizIds),
                eq(quizAttempts.passed, true)
              )
            )
        ).map((a) => a.quizId)
      : []
  );

  const existingCerts = await db
    .select()
    .from(certificates)
    .where(and(eq(certificates.userId, userId), eq(certificates.courseId, courseId)));
  const issuedTrackIds = new Set(existingCerts.map((c) => c.track));

  return CERTIFICATE_TRACKS.map((track) => {
    const trackLessons = allLessons.filter((l) => track.moduleIds.includes(l.moduleId));
    const trackQuizzes = allQuizzes.filter((q) => track.moduleIds.includes(q.moduleId));
    const totalLessons = trackLessons.length;
    const completedCount = trackLessons.filter((l) => completedLessonIds.has(l.id)).length;
    const allQuizzesPassed = trackQuizzes.length > 0 && trackQuizzes.every((q) => passedQuizIds.has(q.id));
    const percent = totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0;
    return {
      track,
      percent,
      completedCount,
      totalLessons,
      allQuizzesPassed,
      eligible: totalLessons > 0 && completedCount === totalLessons && allQuizzesPassed,
      issued: issuedTrackIds.has(track.id),
    };
  });
}
