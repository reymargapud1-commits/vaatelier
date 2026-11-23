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
import niches from "../../../../content/niches.json";

const nicheTitleByCourseId = new Map(niches.niches.map((n) => [n.courseId, n.title]));

/**
 * Coach-facing roster of every enrolled (paid) student: their overall
 * progress through THEIR OWN niche's curriculum (see users.courseId - each
 * student can be in a different niche/course), exactly which lesson
 * they're currently on, how many certificates they've earned, and when
 * they were last active. Built as a handful of bulk queries across every
 * niche at once (grouped per-course in memory) rather than reusing
 * getTrackProgress per student one at a time, since this page needs to
 * scale to the whole student list, not just a single logged-in user.
 */
export default async function AdminStudentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "admin") redirect("/dashboard");

  const allCourses = await db.select().from(courses);
  if (allCourses.length === 0) {
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

  // Build each niche's own curriculum shape once (module order, lesson
  // order, quizzes) - a student's progress is only ever computed against
  // their own niche's copy of this.
  const allModules = await db.select().from(modules);
  const modulesByCourse = new Map<string, typeof allModules>();
  for (const m of allModules) {
    if (!modulesByCourse.has(m.courseId)) modulesByCourse.set(m.courseId, []);
    modulesByCourse.get(m.courseId)!.push(m);
  }

  const allLessons = await db.select().from(lessons);
  const lessonsByModule = new Map<string, typeof allLessons>();
  for (const l of allLessons) {
    if (!lessonsByModule.has(l.moduleId)) lessonsByModule.set(l.moduleId, []);
    lessonsByModule.get(l.moduleId)!.push(l);
  }

  const allQuizzes = await db.select().from(quizzes);
  const quizzesByModule = new Map(allQuizzes.map((q) => [q.moduleId, q]));

  interface CourseShape {
    orderedLessons: typeof allLessons;
    totalLessons: number;
    moduleTitleById: Map<string, string>;
    quizIds: string[];
  }
  const courseShapeById = new Map<string, CourseShape>();
  for (const course of allCourses) {
    const courseModules = (modulesByCourse.get(course.id) || []).sort((a, b) => a.order - b.order);
    const moduleTitleById = new Map(courseModules.map((m) => [m.id, m.title]));
    const orderedLessons = courseModules.flatMap(
      (m) => (lessonsByModule.get(m.id) || []).slice().sort((a, b) => a.order - b.order)
    );
    const quizIds = courseModules
      .map((m) => quizzesByModule.get(m.id)?.id)
      .filter((id): id is string => !!id);
    courseShapeById.set(course.id, {
      orderedLessons,
      totalLessons: orderedLessons.length,
      moduleTitleById,
      quizIds,
    });
  }

  const studentIds = enrolledStudents.map((s) => s.id);
  const allLessonIds = allLessons.map((l) => l.id);
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
    // Hasn't chosen a niche yet (right after enrolling, before the picker) -
    // there's no curriculum to measure progress against yet.
    if (!student.courseId) {
      return {
        id: student.id,
        name: student.name,
        email: student.email,
        paidAt: student.paidAt,
        nicheTitle: null as string | null,
        percent: 0,
        completedCount: 0,
        totalLessons: 0,
        certificatesEarned: certCountByUser.get(student.id) || 0,
        lastActivity: null as Date | null,
        currentPosition: "Hasn't chosen a training niche yet",
      };
    }

    const shape = courseShapeById.get(student.courseId);
    const completed = completedLessonsByUser.get(student.id) || new Set<string>();
    const totalLessons = shape?.totalLessons || 0;
    // Only count completions that belong to this student's own niche - a
    // lesson id from a different niche never appears here anyway (ids are
    // globally unique), but this keeps the math correct if that ever changes.
    const ownLessonIds = new Set((shape?.orderedLessons || []).map((l) => l.id));
    const completedCount = [...completed].filter((id) => ownLessonIds.has(id)).length;
    const percent = totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0;

    const nextLesson = shape?.orderedLessons.find((l) => !completed.has(l.id));
    const currentPosition = nextLesson
      ? `${shape?.moduleTitleById.get(nextLesson.moduleId) || ""} — ${nextLesson.title}`
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
      nicheTitle: nicheTitleByCourseId.get(student.courseId) || student.courseId,
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
                  <th className="px-4 py-3 font-medium">Niche</th>
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
                      {s.nicheTitle ? (
                        s.nicheTitle
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Not chosen yet
                        </span>
                      )}
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
