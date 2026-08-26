import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, quizzes, questions, modules } from "@/db/schema";
import { quizAttempts } from "@/db/schema";
import { checkAndIssueAllCertificates } from "@/lib/certificate-eligibility";

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

  const { quizId, answers } = (await req.json()) as { quizId: string; answers: number[] };

  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }
  const [mod] = await db.select().from(modules).where(eq(modules.id, quiz.moduleId)).limit(1);
  const quizQuestions = await db.select().from(questions).where(eq(questions.quizId, quiz.id));

  let correct = 0;
  const results = quizQuestions.map((q, idx) => {
    const isCorrect = answers[idx] === q.correctIndex;
    if (isCorrect) correct += 1;
    return {
      questionId: q.id,
      correct: isCorrect,
      correctIndex: q.correctIndex,
    };
  });

  const score = quizQuestions.length ? Math.round((correct / quizQuestions.length) * 100) : 0;
  const passed = score >= quiz.passingScore;

  await db.insert(quizAttempts).values({ id: randomUUID(), userId, quizId, score, passed });

  let certificatesIssued: string[] = [];
  if (passed && mod) {
    const issued = await checkAndIssueAllCertificates(userId, mod.courseId);
    certificatesIssued = issued.map((c) => c.track);
  }

  return NextResponse.json({
    score,
    passed,
    passingScore: quiz.passingScore,
    results,
    certificateIssued: certificatesIssued.length > 0,
    certificatesIssued,
  });
}
