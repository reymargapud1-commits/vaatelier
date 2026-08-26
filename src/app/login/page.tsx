"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);
    if (res?.error) {
      setError("Mali ang email o password. Please try again.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-16">
        <div className="card">
          <h1 className="mb-1 text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="mb-6 text-sm text-gray-600">Log in to continue your VA training.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                required
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                required
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Logging in..." : "Log In"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Wala pang account?{" "}
            <Link href="/register" className="font-semibold text-brand-700 hover:underline">
              Create one here
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
