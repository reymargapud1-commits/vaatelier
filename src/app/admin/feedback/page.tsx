import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { desc, inArray } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { trackFeedback, users } from "@/db/schema";
import { getTrackById } from "@/lib/certificate-tracks";
import Navbar from "@/components/Navbar";
import FeedbackTable, { type FeedbackRow } from "@/components/FeedbackTable";

/**
 * Coach-facing feedback review page (/admin/feedback): every star rating +
 * comment a student has left on a certificate track, most recent first, in
 * one place - so instead of digging back through students one at a time,
 * the coach can scan everything here and copy any piece of it (a "Copy"
 * button per entry) straight into a post, slide, or chat when they want to
 * reuse it elsewhere.
 */
export default async function AdminFeedbackPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "admin") redirect("/dashboard");

  const feedbackRows = await db.select().from(trackFeedback).orderBy(desc(trackFeedback.createdAt));

  const userIds = [...new Set(feedbackRows.map((f) => f.userId))];
  const studentRows = userIds.length
    ? await db.select().from(users).where(inArray(users.id, userIds))
    : [];
  const studentById = new Map(studentRows.map((s) => [s.id, s]));

  const rows: FeedbackRow[] = feedbackRows.map((f) => {
    const student = studentById.get(f.userId);
    const trackDef = getTrackById(f.track);
    return {
      id: f.id,
      studentName: student?.name || "Unknown student",
      studentEmail: student?.email || "",
      trackLabel: trackDef ? trackDef.label.replace(/^Certificate [IV]+:\s*/, "") : f.track,
      rating: f.rating,
      comment: f.comment,
      createdAt: f.createdAt.toISOString(),
    };
  });

  const totalCount = rows.length;
  const avgRating = totalCount ? rows.reduce((sum, r) => sum + r.rating, 0) / totalCount : 0;
  const fiveStarCount = rows.filter((r) => r.rating === 5).length;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Review & Feedback</h1>
        <p className="mb-8 text-sm text-gray-600">
          Every star rating and comment your students have left after earning a certificate, most
          recent first. Use "Copy" on any entry to reuse it elsewhere.
        </p>

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="card">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Total Feedback
            </p>
            <p className="mt-1 text-3xl font-extrabold text-gray-900">{totalCount}</p>
          </div>
          <div className="card">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Average Rating
            </p>
            <p className="mt-1 text-3xl font-extrabold text-gray-900">
              {totalCount ? avgRating.toFixed(1) : "—"}
              <span className="text-base font-normal text-gray-400"> / 5</span>
            </p>
          </div>
          <div className="card">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              5-Star Reviews
            </p>
            <p className="mt-1 text-3xl font-extrabold text-gray-900">{fiveStarCount}</p>
          </div>
        </div>

        <FeedbackTable rows={rows} />
      </main>
    </>
  );
}
