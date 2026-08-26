"use client";

import { useState } from "react";
import type { StoreItem } from "@/lib/store-items";

export default function OrderForm({ item }: { item: StoreItem }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const priceDisplay = `₱${(item.amountCentavos / 100).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
  })}`;

  async function handleOrder() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/payment/create-order-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemKey: item.key, note }),
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

  return (
    <div className="card flex flex-col transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-50 text-3xl">
        {item.icon}
      </div>
      <h3 className="mb-1 text-lg font-bold text-gray-900">{item.label}</h3>
      <p className="mb-4 flex-1 text-sm text-gray-600">{item.description}</p>
      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-400">
        Turnaround: {item.turnaround}
      </p>

      <div className="mb-4 flex items-baseline justify-between border-t border-gray-100 pt-4">
        <span className="text-2xl font-extrabold text-gray-900">{priceDisplay}</span>
      </div>

      {!open ? (
        <button onClick={() => setOpen(true)} className="btn-primary w-full">
          Order Now
        </button>
      ) : (
        <div className="space-y-3">
          <textarea
            className="input"
            rows={3}
            placeholder="Optional: anything specific you'd like included?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              disabled={saving}
              className="btn-secondary flex-1 !px-3"
            >
              Cancel
            </button>
            <button onClick={handleOrder} disabled={saving} className="btn-primary flex-1 !px-3">
              {saving ? "Preparing..." : "Place Order"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
