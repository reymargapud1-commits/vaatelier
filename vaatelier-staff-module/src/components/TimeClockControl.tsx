"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TimeClockControl({ clockedIn }: { clockedIn: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function act(action: "clock-in" | "clock-out") {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/staff/${action}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setSaving(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {clockedIn ? (
        <button onClick={() => act("clock-out")} disabled={saving} className="btn-primary w-full !bg-brand-700">
          {saving ? "Clocking out..." : "Clock Out"}
        </button>
      ) : (
        <button onClick={() => act("clock-in")} disabled={saving} className="btn-primary w-full">
          {saving ? "Clocking in..." : "Clock In"}
        </button>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
