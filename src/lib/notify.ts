import nodemailer from "nodemailer";

// Optional SMTP-based notification emails (booking confirmations with a
// .ics calendar attachment, coach booking alerts, student welcome emails).
// Every SMTP_* variable is optional - if they're not set, every function
// below silently no-ops so the rest of the app keeps working exactly the
// same, you just won't get emailed (see README "Live training session
// booking + notifications" and "Enrolled students, welcome emails...").
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const COACH_NOTIFY_EMAIL = process.env.COACH_NOTIFY_EMAIL;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return cachedTransporter;
}

function icsEscape(text: string): string {
  return String(text).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/**
 * Builds a .ics calendar invite for a 1-on-1 live coaching session
 * (2-hour default duration). Pure string builder, no I/O - used both by the
 * downloadable .ics route and as the attachment on notifyCoachOfBooking's
 * email.
 */
export function buildBookingICS(params: {
  bookingId: string;
  studentName: string;
  studentEmail: string;
  coachName: string;
  scheduledAt: Date;
  note?: string | null;
  courseTitle: string;
}): string {
  const { bookingId, studentName, studentEmail, coachName, scheduledAt, note, courseTitle } = params;
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2 hours

  const description = [
    `1-on-1 live coaching session with ${coachName} (The VA Atelier).`,
    `Student: ${studentName} (${studentEmail})`,
    `Program: ${courseTitle}`,
    note ? `Note: ${note}` : null,
  ]
    .filter(Boolean)
    .join("\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The VA Atelier//Live Coaching Session//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${bookingId}@vaatelier`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(`1-on-1 Live Coaching - ${studentName} & ${coachName}`)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/**
 * Emails the coach the moment a booking is confirmed (free or paid), with
 * the session's .ics file attached so it's one click to add to their own
 * calendar. No-ops if SMTP or COACH_NOTIFY_EMAIL aren't configured - the
 * booking always still shows up on /admin/bookings either way.
 */
export async function notifyCoachOfBooking(params: {
  bookingId: string;
  studentName: string;
  studentEmail: string;
  coachName: string;
  scheduledAt: Date;
  note?: string | null;
  courseTitle: string;
}): Promise<void> {
  const transporter = getTransporter();
  if (!transporter || !COACH_NOTIFY_EMAIL) return;

  const { studentName, studentEmail, scheduledAt, note, courseTitle } = params;
  const when = new Date(scheduledAt).toLocaleString("en-PH", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to: COACH_NOTIFY_EMAIL,
      subject: `New coaching session booked - ${studentName}`,
      text: [
        `${studentName} (${studentEmail}) booked a 1-on-1 live coaching session.`,
        `Program: ${courseTitle}`,
        `When: ${when} (Asia/Manila)`,
        note ? `Student's note: ${note}` : null,
        "",
        "View it any time on /admin/bookings.",
      ]
        .filter(Boolean)
        .join("\n"),
      icalEvent: {
        filename: "live-training-session.ics",
        content: buildBookingICS(params),
      },
    });
  } catch (err) {
    console.error("[notify] Failed to email coach about booking:", err);
  }
}

/**
 * Emails a student a short welcome/congratulations message the moment their
 * enrollment is confirmed (instant PayMongo checkout or an approved manual
 * GCash payment). No-ops if SMTP isn't configured - enrollment itself
 * always still succeeds either way.
 */
export async function sendWelcomeEmail(params: {
  studentName: string;
  studentEmail: string;
  courseTitle: string;
}): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  const { studentName, studentEmail, courseTitle } = params;
  const firstName = studentName.split(" ")[0];

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to: studentEmail,
      subject: "Welcome to The VA Atelier! 🎉",
      text: [
        `Hi ${firstName},`,
        "",
        `Congratulations and welcome to The VA Atelier! You're officially enrolled in ${courseTitle}.`,
        "",
        `Log in any time to get started: ${SITE_URL}/login`,
        "",
        "We're excited to help you become a job-ready Virtual Assistant.",
        "",
        "- The VA Atelier",
      ].join("\n"),
    });
  } catch (err) {
    console.error("[notify] Failed to send welcome email:", err);
  }
}
