# The VA Atelier — Virtual Assistant Training Portal

A complete, paid online training portal for aspiring Virtual Assistants. Students pay once
(GCash, Maya, or card via PayMongo) to unlock all training content, then work through video
lessons and quizzes to earn 4 separate certificates. A 1-on-1 live coaching session with you and a
storefront for done-for-you VA application documents are BOTH open to anyone with a free account,
whether or not they ever enroll in the training - registration alone is enough to book a session
or place an order. Only the training content itself (lessons, quizzes, certificates) is behind the
enrollment paywall.

## What's included

- **Landing page** marketing the program, with a "Choose Your Specialty" niche showcase and a
  "Meet Your Trainer" section with real trainer photos.
- **Training niches** (see "Training niches" below): right after enrolling, a student picks the
  VA specialty they want to train for — 6 are currently live (General & Admin, Social Media
  Management, E-commerce, Medical, Bookkeeping, Real Estate), with more easy to add. Each niche
  is a fully separate course.
- **Paywall**: registration is free, but every lesson, quiz, and the video streaming endpoint
  itself re-checks payment status server-side on every request. Nothing leaks before payment.
- **25 narrated video lessons per niche** across 6 modules — e.g. for General & Admin VA: VA
  fundamentals, must-know tools, core service skills, portfolio building, resume/proposal
  writing, and landing your first client. These are auto-generated slide videos (see "About the
  video lessons" below) so you can regenerate or replace them any time.
- **A quiz after every module**, graded server-side, with a passing score.
- **4 separate certificates per niche** (`src/lib/certificate-tracks.ts`), each covering a group of
  modules. A student unlocks a track's certificate once they finish every lesson, pass every
  quiz in that group, AND rate the training (1-5 stars, `src/lib/certificate-eligibility.ts`,
  `track_feedback` table) — a "Congratulations" screen with the star-rating form greets them
  right after their qualifying quiz (`src/components/QuizRunner.tsx`), and the same prompt is
  always available on `/dashboard/certificates` if they skip it there. No live session required.
- **An OPTIONAL 1-on-1 live coaching session** (₱300/2hrs by default, see
  `COACHING_PRICE_CENTAVOS`), open to ANY logged-in student, enrolled or not. An enrolled
  (`isPaid`) student gets their first-ever session completely free
  (`users.freeCoachingSessionUsed`, `api/payment/create-booking-checkout/route.ts`) - confirmed
  immediately with no PayMongo checkout at all. Every booking after that, and every booking from a
  not-yet-enrolled student, goes through the normal ₱300 PayMongo checkout. Rescheduling an
  already-confirmed session (free or paid) never charges again. Once confirmed, you're emailed a
  calendar invite (if you configure email), and it always shows up on your `/admin/bookings` page
  either way (free sessions show as "Free Session" there).
- **An OPTIONAL VA Document Store** (`/dashboard/store`, `src/lib/store-items.ts`), also open to
  ANY logged-in student, enrolled or not — a lot of students already trained elsewhere and just
  need the paperwork. Students order done-for-you CV, portfolio, cover letter, invoice format, or
  intro presentation, paid via PayMongo; orders and their fulfillment status show up on
  `/admin/store-orders`.
- **PayMongo checkout** (GCash, Maya, card) with webhook + fallback verification, shared across
  enrollment, coaching bookings, and store orders (see `payments.purpose`).
- **Enrolled Students roster** (`/admin/students`) — every paying student, which niche they
  chose (or "Not chosen yet"), their overall progress percentage, exactly which lesson they're
  currently on, certificates earned, and last activity date, sorted by most recently active.
- **Review & Feedback page** (`/admin/feedback`) — every star rating and comment students leave
  when unlocking a certificate, in one place, most recent first, with a one-click "Copy" button on
  each entry so you can quickly reuse a piece of feedback elsewhere (a post, a slide, a chat)
  without retyping it.
- **Automatic welcome email**: the moment a student's enrollment payment is confirmed (instant
  PayMongo checkout or a manually-approved GCash payment), they're automatically emailed a
  welcome/congratulations message. Requires the same `SMTP_*` variables as the other notification
  emails below — no extra setup.
- **Welcome Banner generator**: from `/admin/students`, generate a branded, Facebook-postable
  "Welcome to the family" graphic for any enrolled student, with an optional photo (composited into
  a circular gold-ring frame), and download it as a PNG — everything happens live on the site, no
  design tool needed.

## Tech stack

Next.js 14 (App Router) + TypeScript + Tailwind CSS, NextAuth (email/password), Drizzle ORM on
SQLite (via `better-sqlite3`), PayMongo for payments, `pdf-lib` for certificates, `nodemailer` for
optional booking-notification emails. No paid infrastructure required to run this locally.

## 1. Install

```bash
npm install
```

This includes `better-sqlite3`, a native module that compiles a small binary during install.
That needs a normal internet connection (and, on Linux, `python3`/`make`/`g++`, which most systems
already have). If `npm install` fails specifically on `better-sqlite3` in a heavily locked-down
network, install it from a normal connection first, or ask your host/IT to allow
`nodejs.org` and `github.com` for that one install step.

## 2. Configure your `.env`

Copy `.env.example` to `.env` and fill it in:

```bash
cp .env.example .env
```

- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`.
- `PAYMONGO_SECRET_KEY` / `PAYMONGO_PUBLIC_KEY` — from your
  [PayMongo dashboard](https://dashboard.paymongo.com/developers). Use `sk_test_...` /
  `pk_test_...` while developing.
- `PAYMONGO_WEBHOOK_SECRET` — created in step 4 below.
- `TRAINING_PRICE_CENTAVOS` — the enrollment price in centavos (₱499.00 = `49900`).
- `COACHING_PRICE_CENTAVOS` — the optional 1-on-1 coaching session price in centavos (₱300.00 =
  `30000`).
- `COACH_NAME` / `COACH_TITLE` — your name and title. Shown on the landing page and printed as the
  signature on every certificate.
- `COACH_NOTIFY_EMAIL` + `SMTP_*` — optional, see "Live session booking notifications" below.
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — creates a pre-paid admin account when you seed, so
  you can preview the entire paid experience and reach `/admin/bookings` without paying yourself.

## 3. Create the database and load the curriculum

```bash
npm run db:push   # creates dev.db with the schema
npm run seed       # loads content/curriculum.json + content/quizzes.json, creates your admin account
```

> **Note:** this manual step is only for local development. In production, `npm start` (see
> `scripts/bootstrap.ts`) automatically applies database migrations and seeds the curriculum the
> first time it boots — a fresh deployment (Railway, Render, etc.) needs zero manual database
> commands. See the deployment guide link I sent you for the full walkthrough.

Run `npm run seed` again any time after editing `content/curriculum.json` or
`content/quizzes.json` — it's safe to re-run (it updates existing rows instead of duplicating
them).

## 4. Run it

```bash
npm run dev
```

Visit `http://localhost:3000`. Log in with your `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` to see
the full paid dashboard immediately, or register a new (unpaid) account to see the payment gate.

### Testing real payments locally

PayMongo needs to reach your webhook over the public internet, so for local testing use a tunnel
like [ngrok](https://ngrok.com): `ngrok http 3000`, then in the PayMongo dashboard create a
webhook pointed at `https://<your-ngrok-domain>/api/payment/webhook`, subscribed to at least the
`checkout_session.payment.paid` event. Copy the webhook's signing secret into
`PAYMONGO_WEBHOOK_SECRET`, and set `NEXT_PUBLIC_SITE_URL` to your ngrok URL too so PayMongo can
redirect back correctly. Even without this set up, `/payment/success` also double-checks payment
status directly against the PayMongo API as a fallback, so test payments still unlock access.

## Manual GCash payments (no PayMongo account required)

PayMongo (and every other licensed PH payment gateway) requires a DTI Certificate of Business
Name Registration and a BIR Certificate of Registration (Form 2303) before it will activate
GCash/Maya/Card for a sole proprietor — that's a Philippine BSP/AMLA regulatory requirement, not
something this app can work around. Until you have those, students can still pay you directly:

- On the enrollment, coaching-booking, or store-order payment screen, they can choose
  **"Pay via GCash (Manual)"** instead of the PayMongo button.
- It shows your GCash name and number (set `NEXT_PUBLIC_GCASH_NAME` / `NEXT_PUBLIC_GCASH_NUMBER`
  in `.env`) and asks them to send payment directly to you, person-to-person — no gateway or
  merchant registration involved at all.
- They upload a screenshot of their GCash confirmation as proof.
- You review it at `/admin/manual-payments` (also linked from the admin nav) and click
  **Approve** or **Reject**. Approving unlocks their enrollment/booking/order exactly the same way
  an automatic PayMongo payment does.

Optionally drop a QR code image at `public/images/payment/gcash-qr.png` and it will automatically
appear on the manual payment screen above your name and number — if that file isn't there, it
just doesn't show, nothing else to configure. Proof screenshots are private (only the student who
uploaded one and admins can view it) and are stored next to your database file so they survive
redeploys, the same way the database itself does.

This path works completely independently of your PayMongo setup — you can turn it on today, and
switch students over to instant PayMongo checkout later once your DTI/BIR verification is done,
with zero code changes on either side.

## Live training session booking + notifications

Screen near the bottom of the dashboard, and required before the certificate unlocks: the student
picks a date/time for their 1-on-1 session with you. This is always saved and visible at
`/admin/bookings` (log in with your admin account, click "Admin" in the nav). To also get emailed
with a calendar invite attached the moment someone books, fill in `COACH_NOTIFY_EMAIL` and the
`SMTP_*` variables in `.env` with any SMTP provider (a Gmail App Password, Resend, Postmark,
SendGrid SMTP, etc. all work). Leave them blank and everything still works — you just check
`/admin/bookings` instead of your inbox.

Because there's no reliable way to auto-verify someone actually *attended* a live call, the gate
is on **booking** the session, not attendance — that's the part fully in the student's control.

## Enrolled students, welcome emails & welcome banners

`/admin/students` (log in with your admin account, click "Students" in the nav) lists everyone
who's paid for the training, with a progress bar, exactly which lesson they're currently on, how
many of the 4 certificates they've earned, and when they were last active — sorted so your most
recently active students float to the top.

Two things happen automatically the moment a student's enrollment is confirmed (whether that's an
instant PayMongo checkout or you approving a manual GCash payment on `/admin/manual-payments`):

- **A welcome email** goes out to the student — a short, warm congratulations message with a link
  to log in and get started. This uses the same `SMTP_*` variables as the booking/order
  notification emails above; leave them blank and enrollment still works exactly the same, the
  student just won't get an email.
- Nothing else changes automatically — the **Welcome Banner** (below) is something you generate and
  post yourself, on your own timing.

To make a Facebook-postable graphic celebrating a new student: on `/admin/students`, click
"Welcome Banner" next to their name, optionally attach a photo of them (it's cropped into a circle
with a gold ring border), click Generate, then Download. Nothing is saved on the server — it's
rendered fresh every time you click Generate, so re-generating with a different photo is just
clicking it again.

## Training niches

Right after a student enrolls (pays), and before they can see any lesson, they land on a
one-time "Choose Your Specialty" screen (`/dashboard/choose-niche`) and pick the VA specialty
they want to train for. Each niche is a fully separate, self-contained course — its own 6
modules, ~25 narrated video lessons, 6 quizzes, and 4 certificates — not a shared curriculum
with niche-flavored electives bolted on. Once picked, a niche can't be changed from the app
itself (see the comment in `src/app/api/dashboard/choose-niche/route.ts` for why).

Currently live (all 6):

- **General & Admin VA** (`va-foundations`) — the original course: broad administrative
  support, email, calendar, data entry, scheduling, client communication.
- **Social Media Management VA** (`va-social-media`) — content calendars, scheduling,
  community management, and analytics for Facebook, Instagram, and TikTok.
- **E-commerce VA** (`va-ecommerce`) — product listings, order fulfillment, and customer
  service for Shopify and Amazon stores.
- **Medical VA** (`va-medical`) — purely administrative support for medical practices:
  scheduling, EHR data entry, insurance verification, and non-clinical patient communication.
  Never clinical — every lesson and quiz stays strictly on the administrative side, with
  explicit reminders to redirect any clinical question to licensed staff.
- **Bookkeeping VA** (`va-bookkeeping`) — transaction recording, reconciliation, invoicing,
  and basic financial reports using QuickBooks and Xero.
- **Real Estate VA** (`va-real-estate`) — listing coordination, lead follow-up, transaction
  coordination, and marketing support for agents and teams.

Everyone who enrolled before this system existed was automatically kept on General & Admin VA
by a one-time database migration — they were never interrupted with the picker screen.

**How it fits together:**

- `content/niches.json` — the manifest. One entry per niche (courseId, title,
  shortDescription, icon, isPublished, and which curriculum/quizzes file it uses). This drives
  the picker screen, the landing page's niche showcase, and what `npm run seed` loads into the
  database.
- `content/curriculum/<courseId>.json` — that niche's lessons/slides/narration (same JSON
  shape used before niches existed).
- `content/quizzes/<courseId>.json` — that niche's quiz questions.
- `src/lib/certificate-tracks.ts` — each niche's 4 certificate tracks (which modules make up
  Certificate I/II/III/IV).
- `media/videos/<lessonId>.mp4` — narrated lesson videos. Lesson IDs must be globally unique
  across every niche (there's no per-niche subfolder), which is why this project's IDs are
  prefixed per niche (`m1-l1` for General & Admin VA, `sm-m1-l1` for Social Media Management
  VA, `ec-` for E-commerce, `med-` for Medical, `bk-` for Bookkeeping, `re-` for Real Estate) —
  keep that convention for any niche you add.

**Adding another niche:**

1. Write `content/curriculum/<new-course-id>.json` and `content/quizzes/<new-course-id>.json` —
   copy an existing pair as a starting template (same JSON shape), giving every module/lesson/
   quiz ID a prefix unique to this niche so it never collides with another niche's IDs.
2. Add one entry for it to `content/niches.json`.
3. Add a matching 4-track entry for its courseId in `src/lib/certificate-tracks.ts` (4 tracks
   that together cover every module in the new curriculum).
4. Generate its videos:
   ```bash
   VA_CURRICULUM_FILE=content/curriculum/<new-course-id>.json python3 scripts/generate_videos.py
   ```
5. Redeploy. `npm start` re-seeds automatically on every boot (see `scripts/bootstrap.ts`), so
   the new niche appears on the picker and the landing page the moment it's live with
   `"isPublished": true`.

Set `"isPublished": false` on a niche in `content/niches.json` to build it out ahead of time
without showing it to students yet — unpublished niches are hidden from the picker and the
landing page.

## Customizing the curriculum

Edit a niche's own `content/curriculum/<courseId>.json` (lessons/slides/narration) and
`content/quizzes/<courseId>.json` (questions/choices/correct answers), then run `npm run seed`
again. Lesson and quiz IDs (`m1-l1`, `quiz-m1`, etc.) must stay unique across every niche — the
seed script upserts by ID.

## About the video lessons

The 150 lessons across all 6 niches in `media/videos/*.mp4` are narrated slide videos, generated
automatically by `scripts/generate_videos.py`: it renders each slide as a branded PNG,
synthesizes narration with [Piper](https://github.com/OHF-voice/piper1-gpl) (a free, offline
neural text-to-speech engine — no video-hosting or paid TTS account needed, and it sounds like
a natural voice rather than a robotic one), and stitches everything together with `ffmpeg`.

By default it builds `content/curriculum/va-foundations.json` — point it at a different niche
with `VA_CURRICULUM_FILE` (see "Training niches" above), e.g.:

```bash
VA_CURRICULUM_FILE=content/curriculum/va-social-media.json python3 scripts/generate_videos.py
```

To improve this further, you have two options:

1. **Regenerate with a different voice.** Piper has many free voices to choose from. Download
   another voice's `.onnx` + `.onnx.json` pair (browse them at
   [github.com/rhasspy/piper/releases](https://github.com/rhasspy/piper/releases) or
   [huggingface.co/rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices)), then run:
   ```bash
   pip install piper-tts --break-system-packages
   VA_TTS_MODEL=/path/to/your-voice.onnx python3 scripts/generate_videos.py
   ```
   (delete the old files in `media/videos/` first so they get rebuilt rather than skipped). If you
   have access to a commercial TTS API (ElevenLabs, Google Cloud TTS, Azure, etc.) instead, adapt
   the `synthesize_audio()` function in `scripts/generate_videos.py` to call it.
2. **Replace individual lessons with your own recordings.** Just drop a file named
   `<lessonId>.mp4` (e.g. `m1-l1.mp4`) into `media/videos/`, overwriting the generated one — the
   app doesn't care how the file was made, only that the filename matches the lesson ID from
   that niche's curriculum file.

Videos are intentionally stored outside of `/public` and are only ever served through
`/api/stream/[lessonId]`, which re-checks login + payment + that the lesson belongs to the
student's own niche on every request (including video seeking/range requests) — this is what
actually enforces the paywall for video content.

## Deploying

**For a full click-by-click walkthrough (GitHub → Railway → PayMongo, no coding), see the
"Going Live Guide" link I sent alongside this project.** The short version:

This app needs a persistent filesystem for the SQLite database and the video files, so it's
simplest to deploy to a regular server/VPS or a platform like Railway or Render (`npm run build`
then `npm run start`), rather than a serverless platform.

If you do want Vercel or another serverless platform:

- **Database**: serverless functions don't have a persistent filesystem, so swap
  `src/db/index.ts` to use `drizzle-orm/libsql` pointed at a free
  [Turso](https://turso.tech) database instead of `better-sqlite3`. `src/db/schema.ts` needs no
  changes — both are the SQLite dialect.
- **Videos**: upload `media/videos/*.mp4` to an object store (S3, Cloudflare R2, Bunny Stream,
  etc.) and change `/api/stream/[lessonId]/route.ts` to redirect to a signed/expiring URL from
  that store instead of reading a local file, so the paywall check still happens before the
  student ever gets a working video URL.

Either way, remember to:

- Set every variable from `.env.example` in your host's environment variable settings.
- Point `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL` at your real domain.
- Switch `PAYMONGO_SECRET_KEY`/`PAYMONGO_PUBLIC_KEY` to live keys and update the PayMongo webhook
  URL to your real domain once you're ready to accept real payments.

## Project structure

```
content/niches.json         Training niche manifest - one entry per niche, see "Training niches"
content/curriculum/<id>.json  One niche's lesson & slide content (source for both the DB seed and the videos)
content/quizzes/<id>.json   One niche's quiz questions per module
scripts/generate_videos.py  Generates media/videos/*.mp4 from a niche's curriculum JSON
media/videos/*.mp4          The actual lesson video files (served only via /api/stream)
assets/fonts/               Fonts embedded in the certificate PDF and Welcome Banner (Lora, SIL OFL licensed)
assets/signature/           Coach's scanned signature, embedded in the certificate PDF
src/db/schema.ts            Drizzle ORM schema (SQLite)
src/db/seed-logic.ts        Loads every niche in content/niches.json into the database
src/lib/certificate-tracks.ts  Each niche's 4 certificate tracks (which modules make up Certificate I-IV)
src/lib/paymongo.ts         PayMongo checkout + webhook signature verification
src/lib/payment-fulfillment.ts  Shared "mark payment paid/rejected" logic (webhook + manual admin approval)
src/lib/payment-proof-storage.ts  Where manual-GCash proof screenshots are stored on disk
src/lib/notify.ts           Booking/order/welcome notification emails + .ics calendar file generation
src/lib/welcome-banner.ts   Renders the Facebook-postable "Welcome to the family" banner PNG
src/app/dashboard/choose-niche/  One-time "Choose Your Specialty" screen, right after enrollment
src/app/admin/students/     Enrolled Students roster (progress, niche, certificates, welcome banner button)
src/app/admin/feedback/     Review & Feedback page (every star rating/comment, copy-to-share)
src/app/admin/manual-payments/  Admin review screen for manual GCash payments
src/app/                    Next.js App Router pages and API routes
```

## Security notes

- Passwords are hashed with bcrypt; sessions are JWT-based via NextAuth.
- The PayMongo webhook verifies the `Paymongo-Signature` header (HMAC-SHA256) before trusting any
  payment event — never disable this check.
- Every content-serving route (lessons, quizzes, streaming, certificate) re-checks the logged-in
  user's `isPaid` flag from the database on every request; it never trusts client-side state.
- Manual-GCash proof screenshots are served only through `/api/payment-proof/[paymentId]`, which
  re-checks on every request that the requester is either the student who uploaded it or an admin
  — the files themselves are never placed under `public/`.
- Approving or rejecting a manual GCash payment is admin-only (`session.user.role === "admin"`),
  and approval is idempotent — re-approving an already-paid payment is a safe no-op.
