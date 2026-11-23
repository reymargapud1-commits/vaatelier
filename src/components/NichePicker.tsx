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
 * this posts to /api/dashboard/choose-niche, then sends them into their new
 * dashboard. There's no way to change the choice from here on purpose (see
 * that route's comment) - a wrong click is rare enough, and support-fixable,
 * that it isn't worth the complexity of a self-service "switch niche" flow.
 *
 * Each card is a REAL HTML <form> that posts straight to the API route, not
 * only a JS onClick. handleClick is a progressive enhancement: when it runs,
 * it cancels the native submit and does a faster fetch-based flow with no
 * full page reload. If the page's JavaScript ever fails to load or fails to
 * hydrate (a blocked script, a stale cached bundle, an unrelated client-side
 * error) the onClick simply never attaches - and the plain <form> still
 * works, because nothing called preventDefault(): the browser submits it
 * normally and the server redirects straight to /dashboard. That's what
 * stops "I clicked and nothing happened" from ever being possible here.
 */
export default function NichePicker({
  niches,
  initialError,
}: {
  niches: NicheOption[];
  initialError?: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>, courseId: string) {
    e.preventDefault();
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
          <form
            key={n.courseId}
            action="/api/dashboard/choose-niche"
            method="POST"
            className="contents"
          >
            <input type="hidden" name="courseId" value={n.courseId} />
            <button
              type="submit"
              onClick={(e) => handleClick(e, n.courseId)}
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
          </form>
        ))}
      </div>
    </div>
  );
}
