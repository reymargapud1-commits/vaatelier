"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface NicheOption {
  courseId: string;
  title: string;
  shortDescription: string;
  icon: string;
}

/**
 * The "choose your training niche" grid - a student picks exactly one card,
 * this POSTs to /api/dashboard/choose-niche, then sends them into their new
 * dashboard. There's no way to change the choice from here on purpose (see
 * that route's comment) - a wrong click is rare enough, and support-fixable,
 * that it isn't worth the complexity of a self-service "switch niche" flow.
 */
export default function NichePicker({ niches }: { niches: NicheOption[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(courseId: string) {
    setError(null);
    setPendingId(courseId);
    try {
      const res = await fetch("/api/dashboard/choose-niche", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setPendingId(null);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
      setPendingId(null);
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {niches.map((n) => (
          <button
            key={n.courseId}
            onClick={() => choose(n.courseId)}
            disabled={pendingId !== null}
            className="card flex flex-col items-start text-left transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-2xl">
              {n.icon}
            </span>
            <h2 className="mb-1 font-bold text-gray-900">{n.title}</h2>
            <p className="mb-4 flex-1 text-sm text-gray-600">{n.shortDescription}</p>
            <span className="btn-primary w-full text-center">
              {pendingId === n.courseId ? "Starting…" : `Start ${n.title}`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
