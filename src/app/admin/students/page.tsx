import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { and, eq, inArray, desc } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import {
  users,
  courses,
  modules,
  lessons,
  lessonProgress,
  quizzes,
  quizAttempts,
  certificates,
} from "@/db/schema";
import Navbar from "@/components/Navbar";
import WelcomeBannerGenerator from "@/components/WelcomeBannerGenerator";

/**
 * Coach-facing roster of every enrolled (paid) student: their overall
 * progress through the curriculum, exactly which lesson they're currently
 * on, how many certificates they've earned, and when they were last
 * active. Built as a handful of bulk queries (one per table, filtered to
 * just the enrolled students) rather than reusing getTrackProgress per
 * student one at a time, since this page needs to scale to the whole
 * student list at once, not just a single logged-in user.
 */
export default async function AdminStudentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "admin") redirect("/dashboard");

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

  // role = "student" excludes the coach's own admin/preview account from
  // this roster - it's marked isPaid too (so /dashboard shows the full
  // paid experience for previewing), but it isn't a real customer.
  const enrolledStudents = await db
    .select()
    .from(users)
    .where(and(eq(users.isPaid, true), eq(users.role, "student")))
    .orderBy(desc(users.paidAt));

  const courseModules = await db
    .select()
    .from(modules)
    .where(eq(modules.courseId, course.id))
    .orderBy(modules.order);
  const moduleIds = courseModules.map((m) => m.id);
  const moduleOrderById = new Map(courseModules.map((m) => [m.id, m.order]));
  const moduleTitleById = new Map(courseModules.map((m) => [m.id, m.title]));

  const allLessons = moduleIds.length
    ? await db.select().from(lessons).where(inArray(lessons.moduleId, moduleIds))
    : [];
  // Global curriculum order (module order, then lesson order within it) -
  // needed to find each student's next incomplete lesson, i.e. "where they
  // currently are" in the training.
  const orderedLessons = [...allLessons].sort((a, b) => {
    const ma = moduleOrderById.get(a.moduleId) ?? 0;
    const mb = moduleOrderById.get(b.moduleId) ?? 0;
    if (ma !== mb) return ma - mb;
    return a.order - b.order;
  });
  const totalLessons = orderedLessons.length;

  const allQuizzes = moduleIds.length
    ? await db.select().from(quizzes).where(inArray(quizzes.moduleId, moduleIds))
    : [];

  const studentIds = enrolledStudents.map((s) => s.id);
  const allLessonIds = orderedLessons.map((l) => l.id);
  const quizIds = allQuizzes.map((q) => q.id);

  const progressRows =
    studentIds.length && allLessonIds.length
      ? await db
          .select()
          .from(lessonProgress)
          .where(
            and(
              inArray(lessonProgress.userId, studentIds),
              inArray(lessonProgress.lessonId, allLessonIds),
              eq(lessonProgress.completed, true)
            )
          )
      : [];

  const attemptRows =
    studentIds.length && quizIds.length
      ? await db
          .select()
          .from(quizAttempts)
          .where(
            and(
              inArray(quizAttempts.userId, studentIds),
              inArray(quizAttempts.quizId, quizIds),
              eq(quizAttempts.passed, true)
            )
          )
      : [];

  const certRows = studentIds.length
    ? await db.select().from(certificates).where(inArray(certificates.userId, studentIds))
    : [];

  const completedLessonsByUser = new Map<string, Set<string>>();
  const lastLessonActivityByUser = new Map<string, Date>();
  for (const row of progressRows) {
    if (!completedLessonsByUser.has(row.userId)) completedLessonsByUser.set(row.userId, new Set());
    completedLessonsByUser.get(row.userId)!.add(row.lessonId);
    if (row.completedAt) {
      const prev = lastLessonActivityByUser.get(row.userId);
      if (!prev || row.completedAt > prev) lastLessonActivityByUser.set(row.userId, row.completedAt);
    }
  }

  const lastQuizActivityByUser = new Map<string, Date>();
  for (const row of attemptRows) {
    const prev = lastQuizActivityByUser.get(row.userId);
    if (!prev || row.createdAt > prev) lastQuizActivityByUser.set(row.userId, row.createdAt);
  }

  const certCountByUser = new Map<string, number>();
  for (const row of certRows) {
    certCountByUser.set(row.userId, (certCountByUser.get(row.userId) || 0) + 1);
  }

  const studentRows = enrolledStudents.map((student) => {
    const completed = completedLessonsByUser.get(student.id) || new Set<string>();
    const completedCount = completed.size;
    const percent = totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0;

    const nextLesson = orderedLessons.find((l) => !completed.has(l.id));
    const currentPosition = nextLesson
      ? `${moduleTitleById.get(nextLesson.moduleId) || ""} — ${nextLesson.title}`
      : completedCount > 0
        ? "Finished all lessons"
        : "Hasn't started yet";

    const lessonActivity = lastLessonActivityByUser.get(student.id) || null;
    const quizActivity = lastQuizActivityByUser.get(student.id) || null;
    const lastActivity =
      lessonActivity && quizActivity
        ? lessonActivity > quizActivity
          ? lessonActivity
          : quizActivity
        : lessonActivity || quizActivity;

    return {
      id: student.id,
      name: student.name,
      email: student.email,
      paidAt: student.paidAt,
      percent,
      completedCount,
      totalLessons,
      certificatesEarned: certCountByUser.get(student.id) || 0,
      lastActivity,
      currentPosition,
    };
  });

  // Most recently active first, so students who've gone quiet naturally
  // sink toward the bottom (with "hasn't started yet" students last of all).
  studentRows.sort((a, b) => {
    const at = a.lastActivity ? a.lastActivity.getTime() : 0;
    const bt = b.lastActivity ? b.lastActivity.getTime() : 0;
    return bt - at;
  });

  const totalEnrolled = studentRows.length;
  const avgPercent = totalEnrolled
    ? Math.round(studentRows.reduce((sum, s) => sum + s.percent, 0) / totalEnrolled)
    : 0;
  const finishedCount = studentRows.filter(
    (s) => s.totalLessons > 0 && s.completedCount === s.totalLessons
  ).length;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Enrolled Students</h1>
        <p className="mb-8 text-sm text-gray-600">
          Everyone who has paid for the full training program, and exactly where each of them
          currently is in the curriculum.
        </p>

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="card">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Enrolled Students
            </p>
            <p className="mt-1 text-3xl font-extrabold text-gray-900">{totalEnrolled}</p>
          </div>
          <div className="card">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Average Progress
            </p>
            <p className="mt-1 text-3xl font-extrabold text-gray-900">{avgPercent}%</p>
          </div>
          <div className="card">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Finished All Lessons
            </p>
            <p className="mt-1 text-3xl font-extrabold text-gray-900">{finishedCount}</p>
          </div>
        </div>

        {totalEnrolled === 0 ? (
          <p className="text-gray-500">No one has enrolled yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Enrolled</th>
                  <th className="px-4 py-3 font-medium">Progress</th>
                  <th className="px-4 py-3 font-medium">Currently On</th>
                  <th className="px-4 py-3 font-medium">Certificates</th>
                  <th className="px-4 py-3 font-medium">Last Activity</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {studentRows.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-500">{s.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {s.paidAt
                        ? s.paidAt.toLocaleDateString("en-PH", {
                            dateStyle: "medium",
                            timeZone: "Asia/Manila",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-gray-100">
                          <div
                            className="h-2 rounded-full bg-brand-500"
                            style={{ width: `${s.percent}%` }}
                          />
                        </div>
                        <span className="whitespace-nowrap text-xs text-gray-500">
                          {s.completedCount}/{s.totalLessons}
                        </span>
                      </div>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-gray-700">{s.currentPosition}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gold-50 px-2.5 py-1 text-xs font-medium text-gold-700">
                        {s.certificatesEarned}/4
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {s.lastActivity
                        ? s.lastActivity.toLocaleDateString("en-PH", {
                            dateStyle: "medium",
                            timeZone: "Asia/Manila",
                          })
                        : "Not started"}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <WelcomeBannerGenerator studentId={s.id} studentName={s.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
