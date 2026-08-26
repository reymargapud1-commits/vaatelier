import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, lessons, modules, quizzes, lessonProgress } from "@/db/schema";
import Navbar from "@/components/Navbar";
import LessonPlayer from "@/components/LessonPlayer";

export default async function LessonPage({ params }: { params: { lessonId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) redirect("/login");
  if (!user.isPaid) redirect("/payment");

  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, params.lessonId)).limit(1);
  if (!lesson) notFound();

  const [mod] = await db.select().from(modules).where(eq(modules.id, lesson.moduleId)).limit(1);
  if (!mod) notFound();

  const siblingLessons = await db
    .select()
    .from(lessons)
    .where(eq(lessons.moduleId, mod.id))
    .orderBy(lessons.order);
  const [moduleQuiz] = await db.select().from(quizzes).where(eq(quizzes.moduleId, mod.id)).limit(1);

  const [progress] = await db
    .select()
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lesson.id)))
    .limit(1);

  const currentIndex = siblingLessons.findIndex((l) => l.id === lesson.id);
  const nextLesson = siblingLessons[currentIndex + 1];

  let nextHref: string | null = null;
  let nextLabel: string | null = null;
  if (nextLesson) {
    nextHref = `/dashboard/lessons/${nextLesson.id}`;
    nextLabel = "Next Lesson";
  } else if (moduleQuiz) {
    nextHref = `/dashboard/quizzes/${moduleQuiz.id}`;
    nextLabel = "Take Module Quiz";
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link href="/dashboard" className="mb-4 inline-block text-sm text-brand-700 hover:underline">
          ← Back to Dashboard
        </Link>
        <p className="text-sm font-medium text-brand-700">{mod.title}</p>
        <h1 className="mb-4 text-2xl font-bold text-gray-900">{lesson.title}</h1>

        <LessonPlayer
          lessonId={lesson.id}
          initiallyCompleted={!!progress?.completed}
          nextHref={nextHref}
          nextLabel={nextLabel}
        />
      </main>
    </>
  );
}
