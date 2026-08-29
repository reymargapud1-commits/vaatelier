import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import Navbar from "@/components/Navbar";
import BookingForm from "@/components/BookingForm";

export default async function BookingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const [user] = await db.select().from(users).where(eq(users.id, (session.user as any).id)).limit(1);
  if (!user) redirect("/login");

  // Coaching is open to everyone, enrolled or not - only login is required.
  const freeSessionAvailable = user.isPaid && !user.freeCoachingSessionUsed;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-xl px-4 py-10">
        <Link href="/dashboard" className="mb-4 inline-block text-sm text-brand-700 hover:underline">
          ← Back to Dashboard
        </Link>
        <BookingForm freeSessionAvailable={freeSessionAvailable} />
      </main>
    </>
  );
}
