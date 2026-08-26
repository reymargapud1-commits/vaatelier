"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function StorePaymentSuccessPage() {
  const [checking, setChecking] = useState(true);
  const [isPaid, setIsPaid] = useState(false);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 6;

    async function poll() {
      attempts += 1;
      const res = await fetch("/api/payment/verify-order", { method: "POST" });
      const data = await res.json();

      if (data.isPaid) {
        setIsPaid(true);
        setChecking(false);
        return;
      }

      if (attempts >= maxAttempts) {
        setChecking(false);
        return;
      }

      setTimeout(poll, 2000);
    }

    poll();
  }, []);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="card">
          {checking && (
            <>
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
              <h1 className="mb-2 text-xl font-bold text-gray-900">Confirming your payment...</h1>
              <p className="text-sm text-gray-600">Sandali lang, kina-confirm pa ang bayad mo.</p>
            </>
          )}

          {!checking && isPaid && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-3xl">
                🎉
              </div>
              <h1 className="mb-2 text-2xl font-bold text-gray-900">Order Placed!</h1>
              <p className="mb-6 text-gray-600">
                Salamat sa order! Gagawin na ni Coach Reymar ang hiningi mong document — babantayan
                mo na lang ang email mo.
              </p>
              <Link href="/dashboard/store" className="btn-primary w-full">
                Back to Store
              </Link>
            </>
          )}

          {!checking && !isPaid && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-3xl">
                ⏳
              </div>
              <h1 className="mb-2 text-2xl font-bold text-gray-900">Still Processing</h1>
              <p className="mb-6 text-gray-600">
                Minsan a few minutes bago ma-confirm ng PayMongo ang payment. Check ulit shortly.
              </p>
              <Link href="/dashboard/store" className="btn-secondary w-full">
                Back to Store
              </Link>
            </>
          )}
        </div>
      </main>
    </>
  );
}
