"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function BookingPaymentSuccessPage() {
  const [checking, setChecking] = useState(true);
  const [isPaid, setIsPaid] = useState(false);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 6;

    async function poll() {
      attempts += 1;
      const res = await fetch("/api/payment/verify-booking", { method: "POST" });
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
              <h1 className="mb-2 text-2xl font-bold text-gray-900">Session Booked!</h1>
              <p className="mb-6 text-gray-600">
                Salamat! Na-notify na si Coach Reymar. Makikita mo ang schedule mo sa page na ito.
              </p>
              <Link href="/dashboard/booking" className="btn-primary w-full">
                View My Session
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
                Minsan a few minutes bago ma-confirm ng PayMongo ang payment. Check ulit sa page
                ng booking mo shortly.
              </p>
              <Link href="/dashboard/booking" className="btn-secondary w-full">
                Check My Booking
              </Link>
            </>
          )}
        </div>
      </main>
    </>
  );
}
