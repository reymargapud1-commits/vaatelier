import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { lessons, modules, courses } from "@/db/schema";
import Navbar from "@/components/Navbar";
import VideoWithDiagnostic from "@/components/VideoWithDiagnostic";
import niches from "../../../../../../content/niches.json";

const nicheByCourseId = new Map(niches.niches.map((n) => [n.courseId, n]));

/**
 * Admin-only read-only lesson preview, linked from /admin/curriculum. Plays
 * the exact same video file a student watches (via /api/stream, which lets
 * admins through regardless of their own niche - see that route's
 * comment), but has no "Mark as Complete" button and never touches any
 * student's progress.
 */
export default async function AdminLessonPreviewPage({ params }: { params: { lessonId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "admin") redirect("/dashboard");

  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, params.lessonId)).limit(1);
  if (!lesson) notFound();

  const [mod] = await db.select().from(modules).where(eq(modules.id, lesson.moduleId)).limit(1);
  if (!mod) notFound();

  const [course] = await db.select().from(courses).where(eq(courses.id, mod.courseId)).limit(1);
  const niche = course ? nicheByCourseId.get(course.id) : undefined;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link
          href={`/admin/curriculum#niche-${mod.courseId}`}
          className="mb-4 inline-block text-sm text-brand-700 hover:underline"
        >
          ← Back to Curriculum
        </Link>
        <p className="text-sm font-medium text-brand-700">
          {niche?.icon || "📚"} {course?.title} · {mod.title}
        </p>
        <h1 className="mb-4 text-2xl font-bold text-gray-900">{lesson.title}</h1>

        <div className="overflow-hidden rounded-xl bg-black shadow-lg">
          <VideoWithDiagnostic src={`/api/stream/${lesson.id}`} />
        </div>

        <p className="mt-4 text-sm text-gray-500">
          Preview only — watching this doesn't mark it complete or affect any student's progress.
        </p>
      </main>
    </>
  );
}
