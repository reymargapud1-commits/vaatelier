"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import ManualPaymentPanel from "@/components/ManualPaymentPanel";

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
        setError(data.error || "Couldn't start the payment. Please try again.");
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
            Complete your payment to unlock every video lesson, quiz, and your Certificates of
            Completion. It's a one-time payment for lifetime access.
          </p>

          <div className="mb-6 rounded-lg bg-brand-50 p-5">
            <p className="text-sm font-medium text-brand-700">The VA Atelier Training Program</p>
            <p className="mt-1 text-4xl font-extrabold text-gray-900">₱499</p>
            <p className="mt-1 text-sm text-gray-600">One-time payment · Lifetime access</p>
          </div>

          <ul className="mb-8 space-y-2 text-left text-sm text-gray-700">
            <li>✅ 25 video lessons across 6 modules</li>
            <li>✅ Quizzes after every module</li>
            <li>✅ 4 official Certificates of Completion</li>
            <li>✅ Access to the optional 1-on-1 coaching add-on and VA Document Store</li>
            <li>✅ Pay securely via GCash, Maya, or Card</li>
          </ul>

          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

          <button onClick={handlePay} disabled={loading} className="btn-primary w-full text-lg">
            {loading ? "Preparing secure checkout..." : "Pay Now via GCash / Maya / Card"}
          </button>
          <p className="mb-6 mt-3 text-xs text-gray-400">
            Powered by PayMongo. Your payment details are handled securely by PayMongo, never
            stored on this site.
          </p>

          <div className="mb-4 flex items-center gap-3 text-xs text-gray-400">
            <div className="h-px flex-1 bg-gray-200" />
            OR
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <ManualPaymentPanel
            createEndpoint="/api/payment/create-checkout"
            onSubmitted={() => router.push("/dashboard")}
          />
        </div>
      </main>
    </>
  );
}
