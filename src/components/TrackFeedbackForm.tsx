"use client";

import { useState } from "react";

export default function TrackFeedbackForm({
  track,
  onDone,
}: {
  track: string;
  onDone: (certificateIssued: boolean) => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (rating < 1) {
      setError("Please choose a star rating.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track, rating, comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      onDone(!!data.certificateIssued);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-gray-700">How would you rate this training?</p>
      <div className="mb-4 flex justify-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="text-3xl leading-none transition-transform hover:scale-110"
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
          >
            <span className={(hover || rating) >= star ? "text-amber-400" : "text-gray-200"}>★</span>
          </button>
        ))}
      </div>
      <textarea
        className="input mb-3"
        rows={3}
        placeholder="Any comments about the training? (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <button onClick={handleSubmit} disabled={submitting} className="btn-primary w-full">
        {submitting ? "Submitting..." : "Submit Feedback & Get Certificate"}
      </button>
    </div>
  );
}
