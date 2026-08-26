"use client";

import { useEffect, useState } from "react";

interface Booking {
  id: string;
  scheduledAt: string;
  studentNote: string | null;
  status: string;
}

export default function BookingForm() {
  const [booking, setBooking] = useState<Booking | null | undefined>(undefined);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

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
    const res = await fetch("/api/booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: scheduledAt.toISOString(), note }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong. Please try again.");
      return;
    }
    setSuccess(true);
    setBooking({ id: data.bookingId, scheduledAt: scheduledAt.toISOString(), studentNote: note, status: "requested" });
  }

  if (booking === undefined) {
    return <p className="text-gray-500">Loading...</p>;
  }

  if (booking || success) {
    const b = booking!;
    const scheduled = new Date(b.scheduledAt);
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
        <a href={`/api/booking/ics/${b.id}`} className="btn-primary w-full">
          Add to My Calendar (.ics)
        </a>
        <p className="mt-4 text-xs text-gray-400">
          Need to reschedule? Just submit the form again below with a new date and time.
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

  return (
    <div className="card">
      <h2 className="mb-1 text-xl font-bold text-gray-900">Schedule Your Live Training Session</h2>
      <p className="mb-6 text-sm text-gray-600">
        Bago matapos ang training, kailangan mo munang mag-schedule ng live session with your
        coach. Ito ang huling hakbang bago i-unlock ang iyong Certificate of Completion.
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
          placeholder="e.g. tulong sa resume, mock interview, questions about pricing..."
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={saving} className="btn-primary w-full">
        {saving ? "Scheduling..." : "Schedule My Live Session"}
      </button>
    </form>
  );
}
