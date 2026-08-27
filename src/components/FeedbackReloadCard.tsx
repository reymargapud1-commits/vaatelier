"use client";

import TrackFeedbackForm from "@/components/TrackFeedbackForm";

/**
 * Wraps TrackFeedbackForm for use on the certificates page: once feedback
 * is saved (and the certificate issued server-side), just reload the page
 * so the freshly-earned certificate shows up - same pattern as the
 * "Refresh" button elsewhere on the dashboard.
 */
export default function FeedbackReloadCard({ track, trackLabel }: { track: string; trackLabel: string }) {
  return (
    <div>
      <p className="mb-4 text-sm text-gray-600">
        You've completed every lesson and quiz in <strong>{trackLabel}</strong>. Rate the training
        to unlock your certificate.
      </p>
      <TrackFeedbackForm track={track} onDone={() => window.location.reload()} />
    </div>
  );
}
