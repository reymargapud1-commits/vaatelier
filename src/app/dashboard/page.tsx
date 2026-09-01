import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, courses, modules, lessons, quizzes, lessonProgress, quizAttempts, payments } from "@/db/schema";
import Navbar from "@/components/Navbar";
import { getTrackProgress } from "@/lib/certificate-eligibility";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) redirect("/login");

  // Coaching and the VA Document Store don't require enrollment - a
  // registered-but-not-yet-enrolled student gets a menu of all 3 instead
  // of being forced straight to the enrollment payment page.
  if (!user.isPaid) {
    const [pendingManualPayment] = await db
      .select({ id: payments.id, status: payments.status })
      .from(payments)
      .where(
        and(
          eq(payments.userId, userId),
          eq(payments.provider, "manual_gcash"),
          eq(payments.purpose, "enrollment"),
          inArray(payments.status, ["awaiting_proof", "pending_review"])
        )
      )
      .limit(1);

    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-3xl">
            👋
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Welcome, {user.name.split(" ")[0]}!</h1>
          <p className="mx-auto mb-10 max-w-lg text-gray-600">
            You're registered, but haven't enrolled in the full training yet. Here's what you can
            do right now:
          </p>

          {pendingManualPayment && pendingManualPayment.status === "pending_review" && (
            <div className="mx-auto mb-8 max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-4 text-left">
              <p className="font-semibold text-amber-800">⏳ Verifying your enrollment payment</p>
              <p className="mt-1 text-sm text-amber-700">
                We received your GCash payment screenshot and it's being reviewed. This usually
                takes a few hours — your full access will unlock automatically once it's approved.
              </p>
            </div>
          )}

          <div className="grid gap-5 text-left sm:grid-cols-3">
            <div className="card flex flex-col">
              <h2 className="mb-1 font-bold text-gray-900">🎓 Full Training</h2>
              <p className="mb-4 flex-1 text-sm text-gray-600">
                The complete beginner-to-job-ready program. All 4 certificates, plus 1 free
                coaching session.
              </p>
              <Link href="/payment" className="btn-primary w-full">
                Enroll — ₱499
              </Link>
            </div>
            <div className="card flex flex-col">
              <h2 className="mb-1 font-bold text-gray-900">🎙️ 1-on-1 Coaching</h2>
              <p className="mb-4 flex-1 text-sm text-gray-600">
                Personal feedback, mock interviews, and direct access to Coach Reymar. No
                enrollment needed.
              </p>
              <Link href="/dashboard/booking" className="btn-secondary w-full">
                Book — ₱300
              </Link>
            </div>
            <div className="card flex flex-col">
              <h2 className="mb-1 font-bold text-gray-900">🛍️ VA Document Store</h2>
              <p className="mb-4 flex-1 text-sm text-gray-600">
                Done-for-you CV, portfolio, cover letter, and more. No enrollment needed.
              </p>
              <Link href="/dashboard/store" className="btn-secondary w-full">
                Browse Store
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  // Every enrolled student picks a training niche right after paying, before
  // they can see any lesson - see /dashboard/choose-niche. Students who
  // enrolled before niches existed were auto-backfilled to "General & Admin
  // VA" in the migration that added courseId, so they never hit this.
  if (!user.courseId) {
    redirect("/dashboard/choose-niche");
  }

  const [course] = await db.select().from(courses).where(eq(courses.id, user.courseId)).limit(1);

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

  const totalLessons = allLessonIds.length;
  const completedCount = completedLessonIds.size;
  const percent = totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0;

  const trackProgress = await getTrackProgress(userId, course.id);
  const certificatesEarned = trackProgress.filter((t) => t.issued).length;

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

          <Link
            href="/dashboard/certificates"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-semibold text-brand-700 shadow transition hover:bg-brand-50"
          >
            🎓 {certificatesEarned > 0 ? `View Your Certificates (${certificatesEarned}/4 earned)` : "View Your 4 Certificates"}
          </Link>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="card flex items-center justify-between gap-4 border-2 border-dashed border-brand-200 bg-brand-50/40">
            <div>
              <h2 className="font-bold text-gray-900">🎙️ 1-on-1 Live Coaching</h2>
              <p className="mt-1 text-sm text-gray-600">
                {user.freeCoachingSessionUsed
                  ? "Optional — ₱300/session. Personal feedback, mock interviews, and direct access to Coach Reymar."
                  : "Your first session is FREE. Personal feedback, mock interviews, and direct access to Coach Reymar."}
              </p>
            </div>
            <Link href="/dashboard/booking" className="btn-secondary whitespace-nowrap !px-3 !py-2 text-sm">
              Book
            </Link>
          </div>
          <div className="card flex items-center justify-between gap-4 border-2 border-dashed border-gold-300 bg-gold-50/40">
            <div>
              <h2 className="font-bold text-gray-900">🛍️ VA Document Store</h2>
              <p className="mt-1 text-sm text-gray-600">
                Order a done-for-you CV, portfolio, cover letter, invoice format, or intro
                presentation.
              </p>
            </div>
            <Link href="/dashboard/store" className="btn-secondary whitespace-nowrap !px-3 !py-2 text-sm">
              Shop
            </Link>
          </div>
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
        </div>
      </main>
    </>
  );
}
