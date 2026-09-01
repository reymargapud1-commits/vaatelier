"use client";

import { useState } from "react";
import Link from "next/link";
import VideoWithDiagnostic from "./VideoWithDiagnostic";

export default function LessonPlayer({
  lessonId,
  initiallyCompleted,
  nextHref,
  nextLabel,
}: {
  lessonId: string;
  initiallyCompleted: boolean;
  nextHref: string | null;
  nextLabel: string | null;
}) {
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [saving, setSaving] = useState(false);

  async function markComplete() {
    setSaving(true);
    await fetch("/api/lesson/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId }),
    });
    setCompleted(true);
    setSaving(false);
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl bg-black shadow-lg">
        <VideoWithDiagnostic
          lessonKey={lessonId}
          onEnded={markComplete}
          src={`/api/stream/${lessonId}`}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={markComplete}
          disabled={saving || completed}
          className={completed ? "btn-secondary" : "btn-primary"}
        >
          {completed ? "✓ Marked as Complete" : saving ? "Saving..." : "Mark as Complete"}
        </button>

        {nextHref && (
          <Link href={nextHref} className="btn-secondary">
            {nextLabel} →
          </Link>
        )}
      </div>
    </div>
  );
}
