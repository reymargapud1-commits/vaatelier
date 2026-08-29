"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OrderStatusControl({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function updateStatus(status: string) {
    setSaving(true);
    await fetch(`/api/admin/store-orders/${orderId}`, {
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
      <option value="pending_payment">Awaiting Payment</option>
      <option value="paid">Paid — In Queue</option>
      <option value="in_progress">Being Worked On</option>
      <option value="delivered">Delivered</option>
      <option value="cancelled">Cancelled</option>
    </select>
  );
}
