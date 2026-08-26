# The VA Atelier — Virtual Assistant Training Portal

A complete, paid online training portal for aspiring Virtual Assistants. Students pay first
(GCash, Maya, or card via PayMongo) before they can access any content, then work through video
lessons and quizzes, book a required live 1-on-1 session with you, and earn a certificate you've
personally signed.

## What's included

- **Landing page** marketing the program, with a "Meet Your Trainer" section.
- **Paywall**: registration is free, but every lesson, quiz, and the video streaming endpoint
  itself re-checks payment status server-side on every request. Nothing leaks before payment.
- **22 narrated video lessons** across 6 modules — VA fundamentals, must-know tools, core service
  skills, portfolio building, resume/proposal writing, and landing your first client. These are
  auto-generated slide videos (see "About the video lessons" below) so you can regenerate or
  replace them any time.
- **A quiz after every module**, graded server-side, with a passing score.
- **A required live training session booking** near the end of the course — the student picks a
  date/time, it's saved, you're emailed a calendar invite (if you configure email), and it always
  shows up on your `/admin/bookings` page either way.
- **A certificate of completion**, generated as a real PDF, signed with your name and title, only
  unlocked once a student finishes every lesson, passes every quiz, and books their live session.
- **PayMongo checkout** (GCash, Maya, card) with webhook + fallback verification.

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
- `TRAINING_PRICE_CENTAVOS` — the price in centavos (₱2,999.00 = `299900`).
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

## Customizing the curriculum

Edit `content/curriculum.json` (lessons/slides/narration) and `content/quizzes.json`
(questions/choices/correct answers), then run `npm run seed` again. Lesson and quiz IDs
(`m1-l1`, `quiz-m1`, etc.) must stay unique — the seed script upserts by ID.

## About the video lessons

The 22 lessons in `media/videos/*.mp4` are narrated slide videos, generated automatically by
`scripts/generate_videos.py`: it renders each slide as a branded PNG, synthesizes narration with
[Piper](https://github.com/OHF-voice/piper1-gpl) (a free, offline neural text-to-speech engine —
no video-hosting or paid TTS account needed, and it sounds like a natural voice rather than a
robotic one), and stitches everything together with `ffmpeg`.

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
   `content/curriculum.json`.

Videos are intentionally stored outside of `/public` and are only ever served through
`/api/stream/[lessonId]`, which re-checks login + payment on every request (including video
seeking/range requests) — this is what actually enforces the paywall for video content.

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
content/curriculum.json     Lesson & slide content (source for both the DB seed and the videos)
content/quizzes.json        Quiz questions per module
scripts/generate_videos.py  Generates media/videos/*.mp4 from curriculum.json
media/videos/*.mp4          The actual lesson video files (served only via /api/stream)
assets/fonts/               Fonts embedded in the certificate PDF (Lora, SIL OFL licensed)
src/db/schema.ts            Drizzle ORM schema (SQLite)
src/db/seed.ts              Loads content/*.json into the database
src/lib/paymongo.ts         PayMongo checkout + webhook signature verification
src/lib/notify.ts           Booking notification email + .ics calendar file generation
src/app/                    Next.js App Router pages and API routes
```

## Security notes

- Passwords are hashed with bcrypt; sessions are JWT-based via NextAuth.
- The PayMongo webhook verifies the `Paymongo-Signature` header (HMAC-SHA256) before trusting any
  payment event — never disable this check.
- Every content-serving route (lessons, quizzes, streaming, certificate) re-checks the logged-in
  user's `isPaid` flag from the database on every request; it never trusts client-side state.
