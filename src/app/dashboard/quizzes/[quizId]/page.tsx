import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import Navbar from "@/components/Navbar";
import QuizRunner from "@/components/QuizRunner";

export default async function QuizPage({ params }: { params: { quizId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const [user] = await db.select().from(users).where(eq(users.id, (session.user as any).id)).limit(1);
  if (!user) redirect("/login");
  if (!user.isPaid) redirect("/payment");

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Link href="/dashboard" className="mb-4 inline-block text-sm text-brand-700 hover:underline">
          ← Back to Dashboard
        </Link>
        <QuizRunner quizId={params.quizId} />
      </main>
    </>
  );
}
