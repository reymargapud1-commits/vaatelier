import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { quizzes, questions, modules, courses } from "@/db/schema";
import Navbar from "@/components/Navbar";
import niches from "../../../../../../content/niches.json";

const nicheByCourseId = new Map(niches.niches.map((n) => [n.courseId, n]));

/**
 * Admin-only read-only quiz review, linked from /admin/curriculum. Unlike
 * the student-facing quiz API (which never sends correctIndex before
 * grading), this shows every question WITH its correct answer marked, since
 * it's meant purely for the coach to sanity-check question quality - not
 * for anyone to "take" the quiz here.
 */
export default async function AdminQuizReviewPage({ params }: { params: { quizId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "admin") redirect("/dashboard");

  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, params.quizId)).limit(1);
  if (!quiz) notFound();

  const [mod] = await db.select().from(modules).where(eq(modules.id, quiz.moduleId)).limit(1);
  if (!mod) notFound();

  const [course] = await db.select().from(courses).where(eq(courses.id, mod.courseId)).limit(1);
  const niche = course ? nicheByCourseId.get(course.id) : undefined;

  const quizQuestions = await db.select().from(questions).where(eq(questions.quizId, quiz.id));

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href={`/admin/curriculum#niche-${mod.courseId}`}
          className="mb-4 inline-block text-sm text-brand-700 hover:underline"
        >
          ← Back to Curriculum
        </Link>
        <p className="text-sm font-medium text-brand-700">
          {niche?.icon || "📚"} {course?.title} · {mod.title}
        </p>
        <h1 className="mb-1 text-2xl font-bold text-gray-900">{quiz.title}</h1>
        <p className="mb-6 text-sm text-gray-500">
          Passing score: {quiz.passingScore}% · {quizQuestions.length} questions · correct answer
          marked in green for review
        </p>

        <div className="space-y-4">
          {quizQuestions.map((q, idx) => {
            const choices = JSON.parse(q.choicesJson) as string[];
            return (
              <div key={q.id} className="card">
                <p className="mb-3 font-medium text-gray-900">
                  {idx + 1}. {q.text}
                </p>
                <ul className="space-y-1.5 text-sm">
                  {choices.map((choice, i) => (
                    <li
                      key={i}
                      className={
                        i === q.correctIndex
                          ? "rounded-md bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700"
                          : "rounded-md px-3 py-1.5 text-gray-600"
                      }
                    >
                      {i === q.correctIndex ? "✓ " : ""}
                      {choice}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
