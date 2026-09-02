import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

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
  // Every enrolled (isPaid) student gets exactly ONE free 1-on-1 coaching
  // session. Flips to true the first time they use it - see
  // api/payment/create-booking-checkout/route.ts. Coaching itself is
  // bookable by anyone (enrolled or not) at the regular ₱300 price.
  freeCoachingSessionUsed: integer("free_coaching_session_used", { mode: "boolean" }).notNull().default(false),
  // Which training niche (courses row) this student is taking - see
  // "Training niches" in the README. Null until they pick one, which
  // happens right after enrollment (isPaid flips true) but before they can
  // see any lesson - /dashboard redirects to /dashboard/choose-niche until
  // this is set. Existing students from before niches existed were
  // backfilled to the original course in the migration that added this
  // column, so they were never interrupted with a picker screen.
  courseId: text("course_id").references(() => courses.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const courses = sqliteTable("courses", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  priceCentavos: integer("price_centavos").notNull(),
  coachName: text("coach_name"),
  coachTitle: text("coach_title"),
  // A "course" row IS a training niche - see content/niches.json, which is
  // what actually drives what shows up on the /dashboard/choose-niche
  // picker (only isPublished rows) and how it's presented there.
  shortDescription: text("short_description").notNull().default(""),
  icon: text("icon").notNull().default("💼"),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
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
//
// provider "manual_gcash" is the no-KYB-required fallback: the student
// sends payment directly to the coach's personal GCash and uploads a
// screenshot as proof (proofImagePath - see lib/payment-proof-storage.ts;
// stored next to the SQLite DB file, NOT in public/, both because it's a
// private receipt image and because only the DB's directory is guaranteed
// to survive a Railway redeploy), then an admin reviews it on
// /admin/manual-payments. Status for that path goes
// "awaiting_proof" -> "pending_review" -> "paid" | "rejected". See
// lib/payment-fulfillment.ts for the shared "mark paid" logic used by both
// the PayMongo webhook and the manual-payment admin approval action.
export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull().default("paymongo"), // "paymongo" | "manual_gcash"
  checkoutSessionId: text("checkout_session_id").unique(),
  paymentIntentId: text("payment_intent_id"),
  status: text("status").notNull().default("pending"),
  // "pending" | "paid" | "failed" (paymongo)
  // "awaiting_proof" | "pending_review" | "paid" | "rejected" (manual_gcash)
  amountCentavos: integer("amount_centavos").notNull(),
  purpose: text("purpose").notNull().default("enrollment"), // "enrollment" | "coaching" | "store_order"
  referenceId: text("reference_id"),
  proofImagePath: text("proof_image_path"), // manual_gcash only - filename, see lib/payment-proof-storage.ts
  note: text("note"), // manual_gcash only - optional student message / GCash reference number
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

// -----------------------------------------------------------------------
// Personal client services - Reymar's own outsourced-VA/agent work,
// entirely separate from the training portal's students. A personalClient
// is a business Reymar works FOR as their admin/agent (e.g. 5RJSL Lanuza
// Logistics Corp.). Each one can have its own end-customers
// (personalClientCustomers, e.g. Paintplas Corporation) whose deliveries
// Reymar monitors and bills on the personal client's behalf.
//
// One billingBatch = one "Generate Billing" action: it groups a chosen set
// of deliveryTrips together and produces BOTH documents from that same
// group at once - a Billing Statement (personalClient -> their customer,
// subtotal + 12% VAT) and a Commission Invoice (VA Atelier -> personal
// client, Reymar's flat per-trip fee, no VAT). See lib/billing-pdf.ts for
// the actual PDF rendering of each.
// -----------------------------------------------------------------------

export const personalClients = sqliteTable("personal_clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  industry: text("industry").notNull().default(""),
  businessAddress: text("business_address").notNull().default(""),
  email: text("email").notNull().default(""),
  tin: text("tin").notNull().default(""),
  // Reymar's flat commission per trip when billing THIS personal client as
  // their agent - plain pesos (not centavos), matching how every amount in
  // this feature is entered/displayed (see deliveryTrips.amountRate).
  commissionRatePerTrip: real("commission_rate_per_trip").notNull().default(500),
  preparedByName: text("prepared_by_name").notNull().default(""),
  preparedByTitle: text("prepared_by_title").notNull().default(""),
  confirmedByName: text("confirmed_by_name").notNull().default(""),
  confirmedByTitle: text("confirmed_by_title").notNull().default(""),
  // VA Atelier's own commission-invoice numbering to this personal client -
  // increments every time a billingBatch is generated for any of their
  // customers. Formatted as "VA-####" - see lib/billing-pdf.ts.
  nextInvoiceNumber: integer("next_invoice_number").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const personalClientCustomers = sqliteTable("personal_client_customers", {
  id: text("id").primaryKey(),
  personalClientId: text("personal_client_id").notNull().references(() => personalClients.id),
  name: text("name").notNull(),
  // This customer's own Billing Statement numbering (what the personal
  // client uses to bill THEM) - a 4-digit sequence, e.g. "0203". Editable
  // on the customer's page so it can be set to continue an existing
  // paper-trail sequence.
  nextBsNumber: integer("next_bs_number").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const deliveryTrips = sqliteTable("delivery_trips", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull().references(() => personalClientCustomers.id),
  tripDate: integer("trip_date", { mode: "timestamp" }).notNull(),
  plateNumber: text("plate_number").notNull(),
  driverName: text("driver_name").notNull(),
  helper1Name: text("helper1_name").notNull().default(""),
  helper2Name: text("helper2_name").notNull().default(""),
  routeFrom: text("route_from").notNull(),
  routeTo: text("route_to").notNull(),
  gatePassNumber: text("gate_pass_number").notNull().default(""),
  drSiNumber: text("dr_si_number").notNull().default(""),
  waybillNumber: text("waybill_number").notNull().default(""),
  remarks: text("remarks").notNull().default(""),
  // Plain pesos, VAT-exclusive - matches the source paper billing
  // statement, which enters and displays this figure the same way.
  amountRate: real("amount_rate").notNull(),
  // Set once this trip is included in a "Generate Billing" batch - from
  // then on it's excluded from the unbilled list and can't be picked again.
  billingBatchId: text("billing_batch_id").references(() => billingBatches.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const billingBatches = sqliteTable("billing_batches", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull().references(() => personalClientCustomers.id),
  personalClientId: text("personal_client_id").notNull().references(() => personalClients.id),
  bsNumber: text("bs_number").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  batchDate: integer("batch_date", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  tripCount: integer("trip_count").notNull(),
  subtotal: real("subtotal").notNull(),
  vatAmount: real("vat_amount").notNull(),
  totalToCustomer: real("total_to_customer").notNull(),
  commissionTotal: real("commission_total").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});
