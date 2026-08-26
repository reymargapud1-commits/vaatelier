import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import {
  users,
  courses,
  modules,
  lessons,
  quizzes,
  lessonProgress,
  quizAttempts,
  certificates,
  liveSessionBookings,
} from "@/db/schema";
import Navbar from "@/components/Navbar";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) redirect("/login");
  if (!user.isPaid) redirect("/payment");

  const [course] = await db.select().from(courses).limit(1);

  if (!course) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-16">
          <p className="text-gray-600">
            No course content yet. Run <code>npm run seed</code> to load the curriculum.
          </p>
        </main>
      </>
    );
  }

  const courseModules = await db
    .select()
    .from(modules)
    .where(eq(modules.courseId, course.id))
    .orderBy(modules.order);
  const moduleIds = courseModules.map((m) => m.id);

  const allLessons = moduleIds.length
    ? await db.select().from(lessons).where(inArray(lessons.moduleId, moduleIds)).orderBy(lessons.order)
    : [];
  const allQuizzes = moduleIds.length
    ? await db.select().from(quizzes).where(inArray(quizzes.moduleId, moduleIds))
    : [];

  const lessonsByModule = new Map<string, typeof allLessons>();
  for (const l of allLessons) {
    lessonsByModule.set(l.moduleId, [...(lessonsByModule.get(l.moduleId) || []), l]);
  }
  const quizByModule = new Map(allQuizzes.map((q) => [q.moduleId, q]));

  const allLessonIds = allLessons.map((l) => l.id);
  const progress = allLessonIds.length
    ? await db
        .select()
        .from(lessonProgress)
        .where(
          and(
            eq(lessonProgress.userId, userId),
            inArray(lessonProgress.lessonId, allLessonIds),
            eq(lessonProgress.completed, true)
          )
        )
    : [];
  const completedLessonIds = new Set(progress.map((p) => p.lessonId));

  const quizIds = allQuizzes.map((q) => q.id);
  const attempts = quizIds.length
    ? await db
        .select()
        .from(quizAttempts)
        .where(
          and(
            eq(quizAttempts.userId, userId),
            inArray(quizAttempts.quizId, quizIds),
            eq(quizAttempts.passed, true)
          )
        )
    : [];
  const passedQuizIds = new Set(attempts.map((a) => a.quizId));

  const [certificate] = await db
    .select()
    .from(certificates)
    .where(and(eq(certificates.userId, userId), eq(certificates.courseId, course.id)))
    .limit(1);

  const [booking] = await db
    .select()
    .from(liveSessionBookings)
    .where(and(eq(liveSessionBookings.userId, userId), eq(liveSessionBookings.courseId, course.id)))
    .limit(1);

  const totalLessons = allLessonIds.length;
  const completedCount = completedLessonIds.size;
  const percent = totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0;
  const allQuizzesPassed = quizIds.length > 0 && quizIds.every((id) => passedQuizIds.has(id));
  const readyForLiveSession = percent === 100 && allQuizzesPassed;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-lg sm:p-8">
          <h1 className="text-2xl font-bold">{course.title}</h1>
          <p className="mt-1 text-brand-100">{course.description}</p>

          <div className="mt-5">
            <div className="mb-1 flex justify-between text-sm text-brand-100">
              <span>Your progress</span>
              <span>{percent}% complete</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-white/20">
              <div
                className="h-2.5 rounded-full bg-white transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          {certificate ? (
            <Link
              href="/dashboard/certificate"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-semibold text-brand-700 shadow transition hover:bg-brand-50"
            >
              🎓 View / Download Your Certificate
            </Link>
          ) : readyForLiveSession ? (
            <Link
              href="/dashboard/booking"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-semibold text-brand-700 shadow transition hover:bg-brand-50"
            >
              📅 {booking ? "View Your Scheduled Live Session" : "Final Step: Schedule Your Live Session"}
            </Link>
          ) : null}
        </div>

        <div className="space-y-6">
          {courseModules.map((mod) => {
            const modLessons = lessonsByModule.get(mod.id) || [];
            const quiz = quizByModule.get(mod.id);
            return (
              <div key={mod.id} className="card">
                <h2 className="mb-3 text-lg font-bold text-gray-900">{mod.title}</h2>
                <ul className="space-y-2">
                  {modLessons.map((lesson) => {
                    const done = completedLessonIds.has(lesson.id);
                    return (
                      <li key={lesson.id}>
                        <Link
                          href={`/dashboard/lessons/${lesson.id}`}
                          className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3 text-sm transition hover:border-brand-200 hover:bg-brand-50"
                        >
                          <span className="flex items-center gap-3">
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                                done ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-500"
                              }`}
                            >
                              {done ? "✓" : "▶"}
                            </span>
                            {lesson.title}
                          </span>
                          <span className="text-gray-400">Watch</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>

                {quiz && (
                  <Link
                    href={`/dashboard/quizzes/${quiz.id}`}
                    className={`mt-4 flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition ${
                      passedQuizIds.has(quiz.id)
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                    }`}
                  >
                    <span>
                      📝 {quiz.title}
                      {passedQuizIds.has(quiz.id) ? " — Passed" : ""}
                    </span>
                    <span>{passedQuizIds.has(quiz.id) ? "Retake" : "Take Quiz"}</span>
                  </Link>
                )}
              </div>
            );
          })}

          <div className={`card border-2 ${readyForLiveSession ? "border-brand-200" : "border-dashed border-gray-200 opacity-70"}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  🎙️ Final Step: Live Training Session
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {booking
                    ? `Scheduled for ${booking.scheduledAt.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" })}.`
                    : "Complete all lessons and quizzes to unlock scheduling your required 1-on-1 live session with your coach."}
                </p>
              </div>
              {readyForLiveSession && (
                <Link href="/dashboard/booking" className="btn-primary whitespace-nowrap">
                  {booking ? "View / Reschedule" : "Schedule Now"}
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
