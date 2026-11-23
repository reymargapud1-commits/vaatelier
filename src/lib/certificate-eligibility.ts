import { randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { lessons, quizzes, lessonProgress, quizAttempts, certificates, trackFeedback } from "@/db/schema";
import { getTracksForCourse, getTrackById, type CertificateTrack } from "./certificate-tracks";

/**
 * A student earns one certificate per track once they've: finished every
 * lesson in the track's modules, passed every one of those modules' quizzes,
 * AND rated the track (1-5 stars, track_feedback) - see README "4 separate
 * certificates per niche" and src/lib/certificate-tracks.ts for what modules
 * make up each track.
 */
async function computeTrackStats(
  userId: string,
  track: CertificateTrack
): Promise<{ percent: number; lessonsDone: boolean; quizzesPassed: boolean }> {
  const moduleIds = track.moduleIds;

  const trackLessons = moduleIds.length
    ? await db.select().from(lessons).where(inArray(lessons.moduleId, moduleIds))
    : [];
  const lessonIds = trackLessons.map((l) => l.id);
  const totalLessons = lessonIds.length;

  const completedRows = lessonIds.length
    ? await db
        .select()
        .from(lessonProgress)
        .where(
          and(
            eq(lessonProgress.userId, userId),
            inArray(lessonProgress.lessonId, lessonIds),
            eq(lessonProgress.completed, true)
          )
        )
    : [];
  const completedCount = new Set(completedRows.map((r) => r.lessonId)).size;
  const percent = totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0;
  const lessonsDone = totalLessons > 0 && completedCount >= totalLessons;

  const trackQuizzes = moduleIds.length
    ? await db.select().from(quizzes).where(inArray(quizzes.moduleId, moduleIds))
    : [];
  const quizIds = trackQuizzes.map((q) => q.id);

  let quizzesPassed = false;
  if (quizIds.length) {
    const passedAttempts = await db
      .select()
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.userId, userId),
          inArray(quizAttempts.quizId, quizIds),
          eq(quizAttempts.passed, true)
        )
      );
    const passedQuizIds = new Set(passedAttempts.map((a) => a.quizId));
    quizzesPassed = quizIds.every((id) => passedQuizIds.has(id));
  }

  return { percent, lessonsDone, quizzesPassed };
}

/**
 * Issues the certificate for one track if the student just became eligible
 * (lessons done + quizzes passed + feedback submitted) and it hasn't been
 * issued yet. Returns the newly-created certificate row, or null if it's
 * not eligible yet OR was already issued earlier (so callers that only
 * care about what just changed - e.g. the quiz-submit response - don't
 * re-report an old certificate as freshly earned every time).
 */
export async function checkAndIssueCertificate(userId: string, courseId: string, trackId: string) {
  const track = getTrackById(courseId, trackId);
  if (!track) return null;

  const [existing] = await db
    .select()
    .from(certificates)
    .where(
      and(eq(certificates.userId, userId), eq(certificates.courseId, courseId), eq(certificates.track, trackId))
    )
    .limit(1);
  if (existing) return null;

  const { lessonsDone, quizzesPassed } = await computeTrackStats(userId, track);
  if (!lessonsDone || !quizzesPassed) return null;

  const [feedback] = await db
    .select()
    .from(trackFeedback)
    .where(
      and(
        eq(trackFeedback.userId, userId),
        eq(trackFeedback.courseId, courseId),
        eq(trackFeedback.track, trackId)
      )
    )
    .limit(1);
  if (!feedback) return null;

  const id = randomUUID();
  await db.insert(certificates).values({ id, userId, courseId, track: trackId });
  const [created] = await db.select().from(certificates).where(eq(certificates.id, id)).limit(1);
  return created || null;
}

/** Runs checkAndIssueCertificate across every track in the course; returns only the ones newly issued by this call. */
export async function checkAndIssueAllCertificates(userId: string, courseId: string) {
  const tracks = getTracksForCourse(courseId);
  const issued: NonNullable<Awaited<ReturnType<typeof checkAndIssueCertificate>>>[] = [];
  for (const track of tracks) {
    const cert = await checkAndIssueCertificate(userId, courseId, track.id);
    if (cert) issued.push(cert);
  }
  return issued;
}

/**
 * Tracks the student has fully finished (lessons + quizzes) but hasn't
 * rated yet, and hasn't already earned a certificate for - these are what
 * trigger the "Congratulations, rate this section" prompt.
 */
export async function getTracksAwaitingFeedback(userId: string, courseId: string): Promise<CertificateTrack[]> {
  const tracks = getTracksForCourse(courseId);
  const result: CertificateTrack[] = [];

  for (const track of tracks) {
    const [existingCert] = await db
      .select()
      .from(certificates)
      .where(
        and(eq(certificates.userId, userId), eq(certificates.courseId, courseId), eq(certificates.track, track.id))
      )
      .limit(1);
    if (existingCert) continue;

    const { lessonsDone, quizzesPassed } = await computeTrackStats(userId, track);
    if (!lessonsDone || !quizzesPassed) continue;

    const [feedback] = await db
      .select()
      .from(trackFeedback)
      .where(
        and(
          eq(trackFeedback.userId, userId),
          eq(trackFeedback.courseId, courseId),
          eq(trackFeedback.track, track.id)
        )
      )
      .limit(1);
    if (feedback) continue;

    result.push(track);
  }

  return result;
}

export interface TrackProgress {
  track: CertificateTrack;
  percent: number;
  eligible: boolean;
  issued: boolean;
  awaitingFeedback: boolean;
}

/** Full per-track progress for a course, used by /dashboard and /dashboard/certificates. */
export async function getTrackProgress(userId: string, courseId: string): Promise<TrackProgress[]> {
  const tracks = getTracksForCourse(courseId);

  const issuedCerts = await db
    .select()
    .from(certificates)
    .where(and(eq(certificates.userId, userId), eq(certificates.courseId, courseId)));
  const issuedTrackIds = new Set(issuedCerts.map((c) => c.track));

  const feedbackRows = await db
    .select()
    .from(trackFeedback)
    .where(and(eq(trackFeedback.userId, userId), eq(trackFeedback.courseId, courseId)));
  const feedbackTrackIds = new Set(feedbackRows.map((f) => f.track));

  const result: TrackProgress[] = [];
  for (const track of tracks) {
    const issued = issuedTrackIds.has(track.id);
    const { percent, lessonsDone, quizzesPassed } = await computeTrackStats(userId, track);
    const eligible = lessonsDone;
    const awaitingFeedback = !issued && lessonsDone && quizzesPassed && !feedbackTrackIds.has(track.id);
    result.push({ track, percent, eligible, issued, awaitingFeedback });
  }

  return result;
}
