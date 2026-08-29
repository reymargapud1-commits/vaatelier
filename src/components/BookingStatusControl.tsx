"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BookingStatusControl({
  bookingId,
  currentStatus,
}: {
  bookingId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function updateStatus(status: string) {
    setSaving(true);
    await fetch(`/api/admin/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <select
      value={currentStatus}
      disabled={saving}
      onChange={(e) => updateStatus(e.target.value)}
      className="rounded-md border border-gray-300 px-2 py-1 text-xs"
    >
      <option value="requested">Requested</option>
      <option value="confirmed">Confirmed</option>
      <option value="completed">Completed</option>
      <option value="cancelled">Cancelled</option>
    </select>
  );
}
