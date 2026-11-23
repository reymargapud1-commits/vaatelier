import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { courses, modules, lessons, quizzes } from "@/db/schema";
import Navbar from "@/components/Navbar";
import niches from "../../../../content/niches.json";

const nicheOrder = new Map(niches.niches.map((n, i) => [n.courseId, i]));
const nicheByCourseId = new Map(niches.niches.map((n) => [n.courseId, n]));

/**
 * Admin-only browse-everything view of every niche's curriculum: every
 * module, every lesson, and every quiz, across all 6 niches, in one place -
 * so the coach can review content quality without needing to enroll,
 * pick a niche, or hunt through the student dashboard one niche at a time.
 * Read-only: watching a lesson here does NOT mark it complete, and this
 * page doesn't touch any student's progress.
 */
export default async function AdminCurriculumPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "admin") redirect("/dashboard");

  const allCourses = await db.select().from(courses);
  allCourses.sort((a, b) => (nicheOrder.get(a.id) ?? 99) - (nicheOrder.get(b.id) ?? 99));

  const allModules = await db.select().from(modules);
  const allLessons = await db.select().from(lessons);
  const allQuizzes = await db.select().from(quizzes);

  const modulesByCourse = new Map<string, typeof allModules>();
  for (const m of allModules) {
    if (!modulesByCourse.has(m.courseId)) modulesByCourse.set(m.courseId, []);
    modulesByCourse.get(m.courseId)!.push(m);
  }
  const lessonsByModule = new Map<string, typeof allLessons>();
  for (const l of allLessons) {
    if (!lessonsByModule.has(l.moduleId)) lessonsByModule.set(l.moduleId, []);
    lessonsByModule.get(l.moduleId)!.push(l);
  }
  const quizByModule = new Map(allQuizzes.map((q) => [q.moduleId, q]));

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

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Curriculum — All Niches</h1>
        <p className="mb-8 text-sm text-gray-600">
          Every module, lesson, and quiz across all {allCourses.length} training niches, for
          review. Watching a lesson here never marks it complete or affects any student's
          progress.
        </p>

        <div className="mb-8 flex flex-wrap gap-2">
          {allCourses.map((c) => {
            const niche = nicheByCourseId.get(c.id);
            return (
              <a
                key={c.id}
                href={`#niche-${c.id}`}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:border-brand-300 hover:text-brand-700"
              >
                {niche?.icon || "📚"} {niche?.title || c.title}
              </a>
            );
          })}
        </div>

        <div className="space-y-10">
          {allCourses.map((course) => {
            const niche = nicheByCourseId.get(course.id);
            const courseModules = (modulesByCourse.get(course.id) || []).sort((a, b) => a.order - b.order);
            const totalLessons = courseModules.reduce(
              (sum, m) => sum + (lessonsByModule.get(m.id)?.length || 0),
              0
            );

            return (
              <section key={course.id} id={`niche-${course.id}`} className="scroll-mt-20">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xl">
                    {niche?.icon || "📚"}
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{course.title}</h2>
                    <p className="text-xs text-gray-500">
                      {courseModules.length} modules · {totalLessons} lessons ·{" "}
                      {courseModules.filter((m) => quizByModule.has(m.id)).length} quizzes
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {courseModules.map((mod) => {
                    const modLessons = (lessonsByModule.get(mod.id) || []).sort((a, b) => a.order - b.order);
                    const quiz = quizByModule.get(mod.id);
                    return (
                      <details key={mod.id} className="card group">
                        <summary className="cursor-pointer list-none font-semibold text-gray-900 marker:content-none">
                          <span className="mr-2 inline-block text-gray-400 transition group-open:rotate-90">▶</span>
                          {mod.title}
                          <span className="ml-2 text-xs font-normal text-gray-400">
                            ({modLessons.length} lessons)
                          </span>
                        </summary>
                        <ul className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
                          {modLessons.map((lesson) => (
                            <li key={lesson.id}>
                              <Link
                                href={`/admin/curriculum/lesson/${lesson.id}`}
                                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700"
                              >
                                <span>▶ {lesson.title}</span>
                                <span className="text-xs text-gray-400">Watch</span>
                              </Link>
                            </li>
                          ))}
                          {quiz && (
                            <li>
                              <Link
                                href={`/admin/curriculum/quiz/${quiz.id}`}
                                className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
                              >
                                <span>📝 {quiz.title}</span>
                                <span className="text-xs">Review</span>
                              </Link>
                            </li>
                          )}
                        </ul>
                      </details>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}
