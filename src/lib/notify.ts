import nodemailer from "nodemailer";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function toICSDate(d: Date) {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeICS(text: string) {
  return text.replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
}

export interface BookingCalendarInfo {
  bookingId: string;
  studentName: string;
  studentEmail: string;
  coachName: string;
  scheduledAt: Date;
  durationMinutes?: number;
  note?: string | null;
  courseTitle: string;
}

/**
 * Builds a standard .ics calendar file (no external library needed) for the
 * booked live training session, so both the student and the coach can add
 * it straight to Google Calendar / Outlook / Apple Calendar.
 */
export function buildBookingICS(info: BookingCalendarInfo): string {
  const start = info.scheduledAt;
  const end = new Date(start.getTime() + (info.durationMinutes || 45) * 60 * 1000);
  const now = new Date();

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The VA Atelier//Live Session//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${info.bookingId}@va-atelier`,
    `DTSTAMP:${toICSDate(now)}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${escapeICS(`Live VA Training Session - ${info.studentName}`)}`,
    `DESCRIPTION:${escapeICS(
      `Required live training session for ${info.courseTitle}.\nStudent: ${info.studentName} (${info.studentEmail})\nCoach: ${info.coachName}${
        info.note ? `\nStudent note: ${info.note}` : ""
      }`
    )}`,
    `ORGANIZER;CN=${escapeICS(info.coachName)}:mailto:${process.env.COACH_NOTIFY_EMAIL || "coach@example.com"}`,
    `ATTENDEE;CN=${escapeICS(info.studentName)};RSVP=TRUE:mailto:${info.studentEmail}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

/**
 * Emails the coach whenever a student books their live training session, so
 * it lands on the coach's calendar and they get notified automatically.
 * If SMTP_* env vars aren't configured, this silently no-ops - the booking
 * is still saved and always visible on the /admin/bookings page.
 */
export async function notifyCoachOfBooking(info: BookingCalendarInfo) {
  const coachEmail = process.env.COACH_NOTIFY_EMAIL;
  const transport = getTransport();
  if (!transport || !coachEmail) {
    console.log(
      "[notify] SMTP or COACH_NOTIFY_EMAIL not configured - skipping email. " +
        "Booking is still saved and visible on /admin/bookings."
    );
    return { sent: false };
  }

  const ics = buildBookingICS(info);
  const when = info.scheduledAt.toLocaleString("en-PH", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });

  try {
    await transport.sendMail({
      from: `"The VA Atelier" <${process.env.SMTP_USER}>`,
      to: coachEmail,
      subject: `Paid live session booked by ${info.studentName}`,
      text: `${info.studentName} (${info.studentEmail}) paid for and booked a 1-on-1 live coaching session for ${when} (Asia/Manila).\n\nNote from student: ${
        info.note || "(none)"
      }\n\nA calendar invite is attached.`,
      icalEvent: {
        filename: "live-session.ics",
        method: "PUBLISH",
        content: ics,
      },
    });
    return { sent: true };
  } catch (err) {
    console.error("Failed to send booking notification email:", err);
    return { sent: false, error: err };
  }
}

/**
 * Emails the coach whenever a student places (and pays for) a custom VA
 * document order. Silently no-ops if SMTP isn't configured - the order is
 * still saved and visible on /admin/store-orders.
 */
/**
 * Emails the STUDENT (not the coach, unlike the other notify* functions
 * here) a warm welcome/congratulations message the moment their enrollment
 * payment is confirmed - whether that's an instant PayMongo checkout or a
 * manually-approved GCash payment. Silently no-ops if SMTP isn't
 * configured, same resilience pattern as the coach notifications: the
 * enrollment itself is never blocked or delayed by this.
 */
export async function sendWelcomeEmail(info: {
  studentName: string;
  studentEmail: string;
  courseTitle: string;
}) {
  const transport = getTransport();
  if (!transport) {
    console.log(
      "[notify] SMTP not configured - skipping welcome email. " +
        "Enrollment itself is unaffected."
    );
    return { sent: false };
  }

  const firstName = info.studentName.trim().split(/\s+/)[0] || info.studentName;
  const coachName = process.env.COACH_NAME || "Reymar Gapud";
  const siteUrl = (process.env.NEXTAUTH_URL || "https://thevaatelier.online").replace(/\/$/, "");

  try {
    await transport.sendMail({
      from: `"The VA Atelier" <${process.env.SMTP_USER}>`,
      to: info.studentEmail,
      subject: `Welcome to The VA Atelier, ${firstName}!`,
      text: `Hi ${firstName},

Welcome to The VA Atelier! Your enrollment in ${info.courseTitle} is now confirmed, and you have full access to your training dashboard.

Here's what to do next:
1. Log in at ${siteUrl}/login
2. Start with Module 1 and work through the lessons and quizzes at your own pace
3. Book your free 1-on-1 coaching session whenever you're ready

If you have any questions along the way, just reach out - I'm here to help you succeed.

Congratulations again, and welcome to the family!

${coachName}
The VA Atelier`,
      html: `<div style="font-family:Georgia,'Times New Roman',serif;max-width:520px;margin:0 auto;color:#2b1620;">
  <div style="background:linear-gradient(135deg,#2b1620,#12090d);padding:32px 28px;border-radius:12px 12px 0 0;text-align:center;">
    <p style="margin:0;letter-spacing:3px;font-size:12px;color:#c7a464;font-weight:600;">THE VA ATELIER</p>
    <h1 style="margin:16px 0 0;color:#faf6f1;font-size:24px;font-weight:400;">Welcome to the family,</h1>
    <p style="margin:4px 0 0;color:#e2c38a;font-size:32px;font-weight:700;">${firstName}</p>
  </div>
  <div style="padding:28px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;">
    <p>Your enrollment in <strong>${info.courseTitle}</strong> is now confirmed, and you have full access to your training dashboard.</p>
    <p style="margin-bottom:4px;">Here's what to do next:</p>
    <ol style="padding-left:20px;">
      <li>Log in at <a href="${siteUrl}/login" style="color:#611829;">${siteUrl}/login</a></li>
      <li>Start with Module 1 and work through the lessons and quizzes at your own pace</li>
      <li>Book your free 1-on-1 coaching session whenever you're ready</li>
    </ol>
    <p>If you have any questions along the way, just reach out - I'm here to help you succeed.</p>
    <p>Congratulations again, and welcome to the family!</p>
    <p style="margin-top:24px;">
      <strong>${coachName}</strong><br />
      <span style="color:#666;font-size:13px;">The VA Atelier</span>
    </p>
  </div>
</div>`,
    });
    return { sent: true };
  } catch (err) {
    console.error("Failed to send welcome email:", err);
    return { sent: false, error: err };
  }
}

export async function notifyCoachOfOrder(info: {
  orderId: string;
  studentName: string;
  studentEmail: string;
  itemLabel: string;
  amountCentavos: number;
  note?: string | null;
}) {
  const coachEmail = process.env.COACH_NOTIFY_EMAIL;
  const transport = getTransport();
  if (!transport || !coachEmail) {
    console.log(
      "[notify] SMTP or COACH_NOTIFY_EMAIL not configured - skipping email. " +
        "Order is still saved and visible on /admin/store-orders."
    );
    return { sent: false };
  }

  try {
    await transport.sendMail({
      from: `"The VA Atelier" <${process.env.SMTP_USER}>`,
      to: coachEmail,
      subject: `New paid store order: ${info.itemLabel} (${info.studentName})`,
      text: `${info.studentName} (${info.studentEmail}) paid ₱${(info.amountCentavos / 100).toFixed(
        2
      )} for: ${info.itemLabel}.\n\nNote from student: ${
        info.note || "(none)"
      }\n\nOrder ID: ${info.orderId}\nManage it at /admin/store-orders.`,
    });
    return { sent: true };
  } catch (err) {
    console.error("Failed to send order notification email:", err);
    return { sent: false, error: err };
  }
}
