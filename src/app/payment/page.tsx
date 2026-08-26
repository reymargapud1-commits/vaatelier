"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function PaymentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (status === "loading") return null;

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  if ((session?.user as any)?.isPaid) {
    router.push("/dashboard");
    return null;
  }

  async function handlePay() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/payment/create-checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Hindi ma-start ang payment. Please try again.");
        setLoading(false);
        return;
      }
      if (data.alreadyPaid) {
        router.push("/dashboard");
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch (e) {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-16">
        <div className="card text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-2xl">
            🔒
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">
            One Step Away From Full Access
          </h1>
          <p className="mb-6 text-gray-600">
            Bayaran muna ang training program para ma-unlock ang lahat ng video lessons, quizzes,
            at Certificate of Completion. Isang beses lang ang bayad, lifetime access na.
          </p>

          <div className="mb-6 rounded-lg bg-brand-50 p-5">
            <p className="text-sm font-medium text-brand-700">VA Foundations Training Program</p>
            <p className="mt-1 text-4xl font-extrabold text-gray-900">₱2,999</p>
            <p className="mt-1 text-sm text-gray-600">One-time payment · Lifetime access</p>
          </div>

          <ul className="mb-8 space-y-2 text-left text-sm text-gray-700">
            <li>✅ 22 video lessons across 6 modules</li>
            <li>✅ Quizzes after every module</li>
            <li>✅ Official Certificate of Completion</li>
            <li>✅ Pay securely via GCash, Maya, or Card</li>
          </ul>

          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

          <button onClick={handlePay} disabled={loading} className="btn-primary w-full text-lg">
            {loading ? "Preparing secure checkout..." : "Pay Now via GCash / Maya / Card"}
          </button>
          <p className="mt-3 text-xs text-gray-400">
            Powered by PayMongo. Your payment details are handled securely by PayMongo, never
            stored on this site.
          </p>
        </div>
      </main>
    </>
  );
}
