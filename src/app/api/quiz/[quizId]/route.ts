import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, quizzes, questions, modules } from "@/db/schema";

export async function GET(_req: Request, { params }: { params: { quizId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, (session.user as any).id))
    .limit(1);
  if (!user?.isPaid) {
    return NextResponse.json({ error: "Payment required" }, { status: 402 });
  }

  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, params.quizId)).limit(1);
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const [mod] = await db.select().from(modules).where(eq(modules.id, quiz.moduleId)).limit(1);
  const quizQuestions = await db.select().from(questions).where(eq(questions.quizId, quiz.id));

  // Never send correctIndex to the client before grading.
  return NextResponse.json({
    id: quiz.id,
    title: quiz.title,
    passingScore: quiz.passingScore,
    moduleTitle: mod?.title || "",
    questions: quizQuestions.map((q) => ({
      id: q.id,
      text: q.text,
      choices: JSON.parse(q.choicesJson) as string[],
    })),
  });
}
