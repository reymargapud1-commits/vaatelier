import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { users, courses, modules, lessons, quizzes, questions, personalClients, personalClientCustomers } from "./schema";

// -----------------------------------------------------------------------
// Training niches: content/niches.json lists every niche (= one course).
// Each niche points at its own curriculum + quizzes JSON file under
// content/. Adding a new niche later is just: write its curriculum +
// quizzes JSON files, add one entry to content/niches.json, and reseed
// (redeploying does this automatically via scripts/bootstrap.ts) - see
// "Training niches" in the README for the full walkthrough.
// -----------------------------------------------------------------------

const CONTENT_DIR = path.join(process.cwd(), "content");

interface NicheManifestEntry {
  courseId: string;
  title: string;
  shortDescription: string;
  icon: string;
  isPublished: boolean;
  curriculumFile: string;
  quizzesFile: string;
}

function loadNiches(): NicheManifestEntry[] {
  const raw = fs.readFileSync(path.join(CONTENT_DIR, "niches.json"), "utf-8");
  return JSON.parse(raw).niches as NicheManifestEntry[];
}

function loadJson(relativePath: string) {
  const raw = fs.readFileSync(path.join(CONTENT_DIR, relativePath), "utf-8");
  return JSON.parse(raw);
}

/**
 * Loads every niche listed in content/niches.json (each niche = one course,
 * with its own curriculum + quizzes JSON file) into the database. Safe to
 * run repeatedly (upserts by ID). Used both by `npm run seed` (CLI) and
 * automatically by scripts/bootstrap.ts on first server boot.
 */
export async function seedDatabase() {
  const niches = loadNiches();
  console.log(`Seeding ${niches.length} training niche(s): ${niches.map((n) => n.courseId).join(", ")}`);

  const coachName = process.env.COACH_NAME || "Reymar Gapud";
  const coachTitle = process.env.COACH_TITLE || "VA Coach & Trainer";
  const priceCentavos = Number(process.env.TRAINING_PRICE_CENTAVOS || 49900);

  for (const niche of niches) {
    const curriculum = loadJson(niche.curriculumFile);
    const quizData = loadJson(niche.quizzesFile);

    const existingCourse = await db.query.courses.findFirst({
      where: eq(courses.id, curriculum.courseId),
    });

    if (existingCourse) {
      // priceCentavos IS included here so that changing
      // TRAINING_PRICE_CENTAVOS and redeploying actually updates the price
      // of every already-seeded course.
      await db
        .update(courses)
        .set({
          title: curriculum.courseTitle,
          description: curriculum.courseDescription,
          priceCentavos,
          coachName,
          coachTitle,
          shortDescription: niche.shortDescription,
          icon: niche.icon,
          isPublished: niche.isPublished,
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
        shortDescription: niche.shortDescription,
        icon: niche.icon,
        isPublished: niche.isPublished,
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

      const quiz = quizData.quizzes.find((q: any) => q.moduleId === mod.id);
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

  await seedPersonalClients();

  console.log("Seed complete.");
}

// -----------------------------------------------------------------------
// Personal client services (Admin > Clients) - Reymar's own outsourced-VA
// work, unrelated to the training portal's students. Unlike the course
// content above, this is meant to be edited freely from the admin UI once
// it exists, so this ONLY inserts the starting record the first time (by
// fixed ID) and never overwrites it again afterward - a redeploy must never
// clobber edits made from /admin/clients.
// -----------------------------------------------------------------------
async function seedPersonalClients() {
  const existing = await db.query.personalClients.findFirst({
    where: eq(personalClients.id, "5rjsl"),
  });
  if (existing) return;

  await db.insert(personalClients).values({
    id: "5rjsl",
    name: "5RJSL Lanuza Logistics Corp.",
    industry: "Trucking Services",
    businessAddress: "A-J. B-1, L-13, Samaka Site, GMA, Cavite",
    email: "5rjstruckingservices@gmail.com / liverjsl@yahoo.com",
    tin: "624-297-819-000 VAT",
    commissionRatePerTrip: 500,
    preparedByName: "Reymar Gapud",
    preparedByTitle: "Trucking Manager",
    nextInvoiceNumber: 1,
  });

  await db.insert(personalClientCustomers).values({
    id: "5rjsl-paintplas",
    personalClientId: "5rjsl",
    name: "Paintplas Corporation",
    // Continues the paper-trail sequence from the last statement (BS #0202)
    // shown in the sample - editable any time from the customer's page.
    nextBsNumber: 203,
  });

  console.log("Seeded personal client: 5RJSL Lanuza Logistics Corp. (customer: Paintplas Corporation)");
}
