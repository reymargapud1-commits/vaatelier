"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ManualPaymentReviewControl({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function act(action: "approve" | "reject") {
    if (action === "reject" && !window.confirm("Reject this payment? The student will need to submit a new proof.")) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/manual-payments/${paymentId}/${action}`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setSaving(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        <button
          onClick={() => act("approve")}
          disabled={saving}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => act("reject")}
          disabled={saving}
          className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
