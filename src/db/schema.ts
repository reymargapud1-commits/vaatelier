import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

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

// A student earns one certificate per "track" (a group of modules) once
// they finish every lesson + pass every quiz in that track - see
// certificate-eligibility.ts and lib/certificate-tracks.ts for the 4 tracks.
export const certificates = sqliteTable("certificates", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  courseId: text("course_id").notNull().references(() => courses.id),
  track: text("track").notNull().default("legacy"),
  issuedAt: integer("issued_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// purpose discriminates what a payment is for; referenceId points at the
// row it pays for (a liveSessionBookings.id for "coaching", a
// storeOrders.id for "store_order", null for "enrollment" since that just
// flips users.isPaid). See api/payment/webhook/route.ts for how each is handled.
export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull().default("paymongo"),
  checkoutSessionId: text("checkout_session_id").unique(),
  paymentIntentId: text("payment_intent_id"),
  status: text("status").notNull().default("pending"), // "pending" | "paid" | "failed"
  amountCentavos: integer("amount_centavos").notNull(),
  purpose: text("purpose").notNull().default("enrollment"), // "enrollment" | "coaching" | "store_order"
  referenceId: text("reference_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// A student may OPTIONALLY book & pay for a 1-on-1 live coaching session
// with the coach. It is no longer required for the certificate - see
// certificate-eligibility.ts, which no longer checks this table at all.
export const liveSessionBookings = sqliteTable("live_session_bookings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  courseId: text("course_id").notNull().references(() => courses.id),
  scheduledAt: integer("scheduled_at", { mode: "timestamp" }).notNull(),
  studentNote: text("student_note"),
  status: text("status").notNull().default("requested"), // "requested" | "confirmed" | "completed" | "cancelled"
  amountCentavos: integer("amount_centavos").notNull().default(30000), // ₱300.00
  paymentStatus: text("payment_status").notNull().default("unpaid"), // "unpaid" | "pending" | "paid"
  checkoutSessionId: text("checkout_session_id").unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// A student rates a track (1-5 stars, plus an optional comment) once they
// finish every lesson and pass every quiz in it. The certificate for that
// track is only issued after this feedback is submitted - see
// checkAndIssueCertificate in certificate-eligibility.ts. One row per
// user + course + track (a resubmission updates it instead of duplicating).
export const trackFeedback = sqliteTable(
  "track_feedback",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    courseId: text("course_id").notNull().references(() => courses.id),
    track: text("track").notNull(),
    rating: integer("rating").notNull(), // 1-5
    comment: text("comment"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => ({
    userCourseTrackUnique: uniqueIndex("track_feedback_user_course_track_unique").on(
      table.userId,
      table.courseId,
      table.track
    ),
  })
);

// Custom orders for VA job-application materials (CV, portfolio, cover
// letter, invoice format, intro presentation) - see lib/store-items.ts.
export const storeOrders = sqliteTable("store_orders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  itemKey: text("item_key").notNull(),
  itemLabel: text("item_label").notNull(),
  amountCentavos: integer("amount_centavos").notNull(),
  customerNote: text("customer_note"),
  status: text("status").notNull().default("pending_payment"), // "pending_payment" | "paid" | "in_progress" | "delivered" | "cancelled"
  checkoutSessionId: text("checkout_session_id").unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});
