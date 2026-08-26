import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// -----------------------------------------------------------------------
// This schema targets the SQLite dialect (via drizzle-orm/sqlite-core), and
// is used both by better-sqlite3 (local dev / a single always-on server)
// and by Turso/libSQL (drizzle-orm/libsql - same schema, drop-in swap) for
// a serverless-friendly production deployment. See README for details.
// -----------------------------------------------------------------------

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("student"), // "student" | "admin"
  isPaid: integer("is_paid", { mode: "boolean" }).notNull().default(false),
  paidAt: integer("paid_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const courses = sqliteTable("courses", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  priceCentavos: integer("price_centavos").notNull(),
  coachName: text("coach_name"),
  coachTitle: text("coach_title"),
});

export const modules = sqliteTable("modules", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  order: integer("order").notNull(),
  courseId: text("course_id").notNull().references(() => courses.id),
});

export const lessons = sqliteTable("lessons", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  order: integer("order").notNull(),
  moduleId: text("module_id").notNull().references(() => modules.id),
});

export const quizzes = sqliteTable("quizzes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  passingScore: integer("passing_score").notNull(),
  moduleId: text("module_id").notNull().unique().references(() => modules.id),
});

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),
  text: text("text").notNull(),
  choicesJson: text("choices_json").notNull(),
  correctIndex: integer("correct_index").notNull(),
  quizId: text("quiz_id").notNull().references(() => quizzes.id),
});

export const lessonProgress = sqliteTable("lesson_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  lessonId: text("lesson_id").notNull().references(() => lessons.id),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

export const quizAttempts = sqliteTable("quiz_attempts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  quizId: text("quiz_id").notNull().references(() => quizzes.id),
  score: integer("score").notNull(),
  passed: integer("passed", { mode: "boolean" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const certificates = sqliteTable("certificates", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  courseId: text("course_id").notNull().references(() => courses.id),
  issuedAt: integer("issued_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull().default("paymongo"),
  checkoutSessionId: text("checkout_session_id").unique(),
  paymentIntentId: text("payment_intent_id"),
  status: text("status").notNull().default("pending"), // "pending" | "paid" | "failed"
  amountCentavos: integer("amount_centavos").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// A student books a required live training session with the coach near the
// end of the program. Booking (not attendance, which can't be verified
// automatically) is what unlocks the certificate - see certificate-eligibility.ts.
export const liveSessionBookings = sqliteTable("live_session_bookings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  courseId: text("course_id").notNull().references(() => courses.id),
  scheduledAt: integer("scheduled_at", { mode: "timestamp" }).notNull(),
  studentNote: text("student_note"),
  status: text("status").notNull().default("requested"), // "requested" | "confirmed" | "completed" | "cancelled"
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});
