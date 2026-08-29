"use client";

import { useState } from "react";

const GCASH_NAME = process.env.NEXT_PUBLIC_GCASH_NAME || "Reymar Gapud";
const GCASH_NUMBER = process.env.NEXT_PUBLIC_GCASH_NUMBER || "(GCash number not set up yet)";

/**
 * The no-KYB-required payment path: the student sends payment directly to
 * the coach's personal GCash, uploads a screenshot as proof, and an admin
 * approves it on /admin/manual-payments. Reused across enrollment,
 * coaching bookings, and store orders - each just passes a different
 * `createEndpoint` + `createBody` for step 1 (see lib/payment-fulfillment.ts
 * for what happens once an admin approves).
 *
 * The GCash name/number come from NEXT_PUBLIC_GCASH_NAME /
 * NEXT_PUBLIC_GCASH_NUMBER (set these in Railway's Variables tab - same
 * pattern as every other configurable value in this app). The QR image is
 * optional: drop a file at public/images/payment/gcash-qr.png and it
 * appears automatically; if it's missing, the image just doesn't render.
 */
export default function ManualPaymentPanel({
  createEndpoint,
  createBody,
  onSubmitted,
}: {
  createEndpoint: string;
  createBody?: Record<string, any>;
  onSubmitted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [qrOk, setQrOk] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (!file) {
      setError("Please attach a screenshot of your GCash payment first.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const createRes = await fetch(createEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...createBody, method: "manual" }),
      });
      const createData = await createRes.json();
      if (!createRes.ok || !createData.paymentId) {
        setError(createData.error || "Couldn't start this payment. Please try again.");
        setSaving(false);
        return;
      }

      const formData = new FormData();
      formData.append("paymentId", createData.paymentId);
      formData.append("proof", file);
      if (note) formData.append("note", note);

      const uploadRes = await fetch("/api/payment/manual/upload-proof", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        setError(uploadData.error || "Couldn't upload your proof of payment. Please try again.");
        setSaving(false);
        return;
      }

      setDone(true);
      onSubmitted?.();
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-center">
        <p className="font-semibold text-emerald-800">Payment submitted for verification!</p>
        <p className="mt-1 text-sm text-emerald-700">
          We'll check your screenshot and activate your access shortly - usually within a few
          hours.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary w-full">
        Pay via GCash (Manual)
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="mb-3 text-sm font-semibold text-gray-900">Send payment via GCash</p>

      <div className="mb-4 rounded-lg bg-brand-50 p-4 text-center">
        {qrOk && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/images/payment/gcash-qr.png"
            alt="GCash QR code"
            className="mx-auto mb-3 h-40 w-40 rounded-lg border border-brand-100 bg-white object-contain"
            onError={() => setQrOk(false)}
          />
        )}
        <p className="text-xs font-medium uppercase tracking-wide text-brand-700">GCash Name</p>
        <p className="mb-2 font-semibold text-gray-900">{GCASH_NAME}</p>
        <p className="text-xs font-medium uppercase tracking-wide text-brand-700">GCash Number</p>
        <p className="text-lg font-bold tracking-wide text-gray-900">{GCASH_NUMBER}</p>
      </div>

      <p className="mb-3 text-sm text-gray-600">
        After sending payment, upload a screenshot of your GCash confirmation below.
      </p>

      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="mb-3 block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700"
      />

      <textarea
        className="input mb-3"
        rows={2}
        placeholder="Optional: GCash reference number or your name on the transaction"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => setOpen(false)}
          disabled={saving}
          className="btn-secondary flex-1 !px-3"
        >
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1 !px-3">
          {saving ? "Submitting..." : "Submit for Verification"}
        </button>
      </div>
    </div>
  );
}
