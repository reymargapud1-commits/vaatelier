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
 * "iischedule niya yun sa calendar, para manotify sken" actually happens.
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
      subject: `New live session booked by ${info.studentName}`,
      text: `${info.studentName} (${info.studentEmail}) booked their required live training session for ${when} (Asia/Manila).\n\nNote from student: ${
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
