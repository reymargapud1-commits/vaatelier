import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, courses } from "@/db/schema";
import Navbar from "@/components/Navbar";
import { getTrackProgress, checkAndIssueAllCertificates } from "@/lib/certificate-eligibility";

export default async function CertificatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) redirect("/login");
  if (!user.isPaid) redirect("/payment");

  const [course] = await db.select().from(courses).limit(1);
  if (!course) redirect("/dashboard");

  // Catch up any track that qualifies but hasn't been issued yet (e.g. if
  // it became eligible retroactively after a schema/logic change).
  await checkAndIssueAllCertificates(userId, course.id);
  const progress = await getTrackProgress(userId, course.id);

  const earnedCount = progress.filter((p) => p.issued).length;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <Link href="/dashboard" className="mb-4 inline-block text-sm text-brand-700 hover:underline">
          ← Back to Dashboard
        </Link>

        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-3xl">
            🎓
          </div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Your Certificates</h1>
          <p className="mt-2 text-gray-600">
            The VA Atelier awards 4 separate certificates as you complete each stage of the
            program. You've earned {earnedCount} of 4 so far.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {progress.map(({ track, percent, allQuizzesPassed, eligible, issued }) => (
            <div
              key={track.id}
              className={`card border-2 ${issued ? "border-emerald-200" : eligible ? "border-brand-200" : "border-dashed border-gray-200"}`}
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {track.subtitle}
              </p>
              <h2 className="mb-3 text-lg font-bold text-gray-900">{track.label}</h2>

              {issued ? (
                <>
                  <p className="mb-4 text-sm text-emerald-700">✓ Earned — ready to download.</p>
                  <a
                    href={`/api/certificate/${course.id}/${track.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary w-full"
                  >
                    View / Download PDF
                  </a>
                </>
              ) : (
                <>
                  <div className="mb-1 flex justify-between text-xs text-gray-500">
                    <span>Lessons</span>
                    <span>{percent}%</span>
                  </div>
                  <div className="mb-3 h-2 w-full rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-brand-500 transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="mb-4 text-sm text-gray-600">
                    {percent < 100
                      ? "Complete all lessons in this section to unlock the quiz requirement."
                      : allQuizzesPassed
                        ? "All requirements met — refresh this page."
                        : "Pass this section's quiz to earn your certificate."}
                  </p>
                  <Link href="/dashboard" className="btn-secondary w-full">
                    Continue This Section
                  </Link>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 card border-2 border-dashed border-brand-200 bg-brand-50/40 text-center">
          <h3 className="mb-1 font-bold text-gray-900">🎙️ Want faster progress?</h3>
          <p className="mb-4 text-sm text-gray-600">
            Book an optional 1-on-1 live coaching session with Coach Reymar for personal feedback
            on your resume, portfolio, and interview skills — ₱300, 2 hours.
          </p>
          <Link href="/dashboard/booking" className="btn-primary">
            Learn More & Book
          </Link>
        </div>
      </main>
    </>
  );
}
