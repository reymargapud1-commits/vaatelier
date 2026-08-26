"use client";

import { useEffect, useState } from "react";

interface Booking {
  id: string;
  scheduledAt: string;
  studentNote: string | null;
  status: string;
  paymentStatus: string;
}

const PRICE_DISPLAY = "₱300";

export default function BookingForm() {
  const [booking, setBooking] = useState<Booking | null | undefined>(undefined);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/booking")
      .then((r) => r.json())
      .then((data) => setBooking(data.booking));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!date || !time) {
      setError("Please choose a date and time.");
      return;
    }
    const scheduledAt = new Date(`${date}T${time}:00`);
    setSaving(true);
    try {
      const res = await fetch("/api/payment/create-booking-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: scheduledAt.toISOString(), note }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setSaving(false);
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  if (booking === undefined) {
    return <p className="text-gray-500">Loading...</p>;
  }

  if (booking && booking.paymentStatus === "paid") {
    const scheduled = new Date(booking.scheduledAt);
    return (
      <div className="card text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">
          📅
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-900">Live Session Scheduled!</h2>
        <p className="mb-1 text-gray-700">
          {scheduled.toLocaleString("en-PH", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: "Asia/Manila",
          })}{" "}
          (Manila time)
        </p>
        <p className="mb-6 text-sm text-gray-500">
          Your coach has been notified. Add it to your own calendar so you don't forget:
        </p>
        <a href={`/api/booking/ics/${booking.id}`} className="btn-primary w-full">
          Add to My Calendar (.ics)
        </a>
        <p className="mt-4 text-xs text-gray-400">
          Need to reschedule? Just submit the form again below with a new date and time — no
          need to pay twice for the same booking.
        </p>

        <details className="mt-6 text-left">
          <summary className="cursor-pointer text-sm font-medium text-brand-700">
            Reschedule
          </summary>
          <div className="mt-4">
            <BookingInnerForm
              date={date}
              time={time}
              note={note}
              setDate={setDate}
              setTime={setTime}
              setNote={setNote}
              onSubmit={handleSubmit}
              saving={saving}
              error={error}
            />
          </div>
        </details>
      </div>
    );
  }

  if (booking && booking.paymentStatus === "pending") {
    return (
      <div className="card text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">
          ⏳
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-900">Finishing Your Booking</h2>
        <p className="mb-6 text-sm text-gray-600">
          Just a moment — we're confirming your payment with PayMongo. If you were redirected
          back here, just refresh this page.
        </p>
        <button onClick={() => window.location.reload()} className="btn-secondary w-full">
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card border-2 border-brand-100 bg-gradient-to-br from-brand-50 to-white">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-full bg-brand-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            Optional Add-On
          </span>
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-900">
          1-on-1 Live Coaching Session with Coach Reymar
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          This is no longer required to earn your certificate — you can finish the training and
          get all your certificates without ever booking this. But if you want to speed up your
          growth as a VA, this session is worth it:
        </p>
        <ul className="mb-5 space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-brand-500">✓</span>
            Personal feedback on your resume, portfolio, and proposals — not generic advice
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-brand-500">✓</span>
            Mock interview practice so you're not caught off guard in a real client interview
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-brand-500">✓</span>
            Ask your real questions directly — no generic FAQ, just you and Coach Reymar
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-brand-500">✓</span>
            2 full hours, at a time that fits your schedule
          </li>
        </ul>
        <div className="flex items-baseline gap-2 rounded-lg bg-white p-4 shadow-sm">
          <span className="text-3xl font-extrabold text-gray-900">{PRICE_DISPLAY}</span>
          <span className="text-sm text-gray-500">per session · 2 hours</span>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-1 text-lg font-bold text-gray-900">Book & Pay for Your Session</h3>
        <p className="mb-6 text-sm text-gray-600">
          Pick a date and time, then you'll be redirected to secure PayMongo checkout. Once your
          payment is confirmed, Coach Reymar is notified and your session is scheduled.
        </p>
        <BookingInnerForm
          date={date}
          time={time}
          note={note}
          setDate={setDate}
          setTime={setTime}
          setNote={setNote}
          onSubmit={handleSubmit}
          saving={saving}
          error={error}
        />
      </div>
    </div>
  );
}

function BookingInnerForm({
  date,
  time,
  note,
  setDate,
  setTime,
  setNote,
  onSubmit,
  saving,
  error,
}: {
  date: string;
  time: string;
  note: string;
  setDate: (v: string) => void;
  setTime: (v: string) => void;
  setNote: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  error: string;
}) {
  const today = new Date().toISOString().split("T")[0];
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
          <input
            type="date"
            required
            min={today}
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Time (Manila)</label>
          <input
            type="time"
            required
            className="input"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Anything you'd like to discuss? (optional)
        </label>
        <textarea
          className="input"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. help with my resume, a mock interview, questions about pricing..."
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={saving} className="btn-primary w-full">
        {saving ? "Preparing secure checkout..." : `Book & Pay ${PRICE_DISPLAY} via GCash / Maya / Card`}
      </button>
    </form>
  );
}
