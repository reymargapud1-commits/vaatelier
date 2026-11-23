import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import Navbar from "@/components/Navbar";
import NichePicker from "@/components/NichePicker";
import niches from "../../../../content/niches.json";

/**
 * The one-time "choose your training niche" screen, shown right after
 * enrollment (isPaid flips true) and before a student can see any lesson -
 * see users.courseId in src/db/schema.ts. Already-enrolled-before-niches
 * students never land here (auto-backfilled in the migration that added
 * courseId); a student with courseId already set is bounced straight to
 * their dashboard.
 */
export default async function ChooseNichePage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) redirect("/login");
  if (!user.isPaid) redirect("/payment");
  if (user.courseId) redirect("/dashboard");

  const publishedNiches = niches.niches.filter((n) => n.isPublished);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-3xl">
            🎯
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            Welcome, {user.name.split(" ")[0]}! Choose Your Training Track
          </h1>
          <p className="mx-auto max-w-xl text-gray-600">
            You're enrolled. Before your first lesson, pick the VA specialty you want to train
            for. Each track is a complete course - its own modules, video lessons, quizzes, and
            certificates.
          </p>
        </div>

        <NichePicker niches={publishedNiches} initialError={searchParams?.error} />
      </main>
    </>
  );
}
