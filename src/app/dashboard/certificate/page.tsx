import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, courses } from "@/db/schema";
import Navbar from "@/components/Navbar";
import { checkAndIssueCertificate } from "@/lib/certificate-eligibility";

export default async function CertificatePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) redirect("/login");
  if (!user.isPaid) redirect("/payment");

  const [course] = await db.select().from(courses).limit(1);
  if (!course) redirect("/dashboard");

  const certificate = await checkAndIssueCertificate(userId, course.id);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        {certificate ? (
          <div className="card">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
              🎓
            </div>
            <h1 className="mb-2 text-2xl font-bold text-gray-900">
              Congratulations, {user.name.split(" ")[0]}!
            </h1>
            <p className="mb-6 text-gray-600">
              You've completed {course.title}. Your Certificate of Completion is ready.
            </p>
            <a
              href={`/api/certificate/${course.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full"
            >
              View / Download Certificate (PDF)
            </a>
            <Link href="/dashboard" className="mt-3 block text-sm text-gray-500 hover:underline">
              Back to Dashboard
            </Link>
          </div>
        ) : (
          <div className="card">
            <h1 className="mb-2 text-xl font-bold text-gray-900">Not Quite Yet</h1>
            <p className="mb-6 text-gray-600">
              Complete every video lesson, pass every module quiz, and schedule your live training
              session to unlock your Certificate of Completion.
            </p>
            <Link href="/dashboard" className="btn-primary w-full">
              Continue Training
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
