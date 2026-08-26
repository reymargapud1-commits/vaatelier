import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { users, courses, modules, lessons, quizzes, questions } from "./schema";
import curriculum from "../../content/curriculum.json";
import quizData from "../../content/quizzes.json";

/**
 * Loads content/curriculum.json + content/quizzes.json into the database.
 * Safe to run repeatedly (upserts by ID). Used both by `npm run seed` (CLI)
 * and automatically by scripts/bootstrap.ts on first server boot.
 */
export async function seedDatabase() {
  console.log("Seeding course, modules, lessons, and quizzes...");

  const existingCourse = await db.query.courses.findFirst({
    where: eq(courses.id, curriculum.courseId),
  });

  const coachName = process.env.COACH_NAME || "Reymar Gapud";
  const coachTitle = process.env.COACH_TITLE || "VA Coach & Trainer";
  const priceCentavos = Number(process.env.TRAINING_PRICE_CENTAVOS || 49900);

  if (existingCourse) {
    // priceCentavos IS included here (unlike an earlier version of this
    // function) so that changing TRAINING_PRICE_CENTAVOS and redeploying
    // actually updates the price of an already-seeded course.
    await db
      .update(courses)
      .set({
        title: curriculum.courseTitle,
        description: curriculum.courseDescription,
        priceCentavos,
        coachName,
        coachTitle,
      })
      .where(eq(courses.id, curriculum.courseId));
  } else {
    await db.insert(courses).values({
      id: curriculum.courseId,
      title: curriculum.courseTitle,
      description: curriculum.courseDescription,
      priceCentavos,
      coachName,
      coachTitle,
    });
  }

  let moduleOrder = 0;
  for (const mod of curriculum.modules) {
    moduleOrder += 1;

    const existingModule = await db.query.modules.findFirst({ where: eq(modules.id, mod.id) });
    if (existingModule) {
      await db
        .update(modules)
        .set({ title: mod.title, order: moduleOrder, courseId: curriculum.courseId })
        .where(eq(modules.id, mod.id));
    } else {
      await db.insert(modules).values({
        id: mod.id,
        title: mod.title,
        order: moduleOrder,
        courseId: curriculum.courseId,
      });
    }

    let lessonOrder = 0;
    for (const lesson of mod.lessons) {
      lessonOrder += 1;
      const existingLesson = await db.query.lessons.findFirst({ where: eq(lessons.id, lesson.id) });
      if (existingLesson) {
        await db
          .update(lessons)
          .set({ title: lesson.title, order: lessonOrder, moduleId: mod.id })
          .where(eq(lessons.id, lesson.id));
      } else {
        await db.insert(lessons).values({
          id: lesson.id,
          title: lesson.title,
          order: lessonOrder,
          moduleId: mod.id,
        });
      }
    }

    const quiz = quizData.quizzes.find((q) => q.moduleId === mod.id);
    if (quiz) {
      const existingQuiz = await db.query.quizzes.findFirst({ where: eq(quizzes.id, quiz.id) });
      if (existingQuiz) {
        await db
          .update(quizzes)
          .set({ title: quiz.title, passingScore: quiz.passingScore, moduleId: mod.id })
          .where(eq(quizzes.id, quiz.id));
      } else {
        await db.insert(quizzes).values({
          id: quiz.id,
          title: quiz.title,
          passingScore: quiz.passingScore,
          moduleId: mod.id,
        });
      }

      for (const q of quiz.questions) {
        const existingQuestion = await db.query.questions.findFirst({ where: eq(questions.id, q.id) });
        const values = {
          text: q.text,
          choicesJson: JSON.stringify(q.choices),
          correctIndex: q.correctIndex,
          quizId: quiz.id,
        };
        if (existingQuestion) {
          await db.update(questions).set(values).where(eq(questions.id, q.id));
        } else {
          await db.insert(questions).values({ id: q.id, ...values });
        }
      }
    }
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const existingAdmin = await db.query.users.findFirst({ where: eq(users.email, adminEmail) });
    if (existingAdmin) {
      await db
        .update(users)
        .set({ passwordHash, role: "admin", isPaid: true, paidAt: new Date() })
        .where(eq(users.email, adminEmail));
    } else {
      await db.insert(users).values({
        id: randomUUID(),
        name: "Admin",
        email: adminEmail,
        passwordHash,
        role: "admin",
        isPaid: true,
        paidAt: new Date(),
      });
    }
    console.log(`Seeded admin account: ${adminEmail}`);
  } else {
    console.log(
      "Tip: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD before seeding to also create a " +
        "pre-paid admin/test account."
    );
  }

  console.log("Seed complete.");
}
