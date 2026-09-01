import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { and, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, trackFeedback } from "@/db/schema";
import { getTrackById } from "@/lib/certificate-tracks";
import { checkAndIssueCertificate } from "@/lib/certificate-eligibility";

/**
 * A student rates a track (1-5 stars, optional comment) once they finish
 * every lesson and pass every quiz in it. Saving feedback is what unlocks
 * that track's certificate - see checkAndIssueCertificate. Resubmitting
 * (e.g. the student wants to change their rating) updates the same row
 * instead of creating a duplicate.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.isPaid) {
    return NextResponse.json({ error: "Payment required" }, { status: 402 });
  }

  const { track, rating, comment } = (await req.json()) as {
    track: string;
    rating: number;
    comment?: string;
  };

  if (!user.courseId) {
    return NextResponse.json({ error: "Choose your training niche first" }, { status: 400 });
  }
  const courseId = user.courseId;

  const trackDef = getTrackById(courseId, track);
  if (!trackDef) {
    return NextResponse.json({ error: "Unknown track" }, { status: 400 });
  }
  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return NextResponse.json({ error: "Please choose a rating from 1 to 5 stars." }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(trackFeedback)
    .where(
      and(
        eq(trackFeedback.userId, userId),
        eq(trackFeedback.courseId, courseId),
        eq(trackFeedback.track, track)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(trackFeedback)
      .set({ rating: ratingNum, comment: comment || null })
      .where(eq(trackFeedback.id, existing.id));
  } else {
    await db.insert(trackFeedback).values({
      id: randomUUID(),
      userId,
      courseId,
      track,
      rating: ratingNum,
      comment: comment || null,
    });
  }

  const issued = await checkAndIssueCertificate(userId, courseId, track);

  return NextResponse.json({ saved: true, certificateIssued: !!issued, track });
}
