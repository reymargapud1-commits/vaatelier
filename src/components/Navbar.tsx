"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-gray-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            VA
          </span>
          <span>VA Foundations</span>
        </Link>

        <nav className="flex items-center gap-3 text-sm">
          {session?.user ? (
            <>
              <Link href="/dashboard" className="text-gray-700 hover:text-brand-700">
                Dashboard
              </Link>
              {(session.user as any).role === "admin" && (
                <Link href="/admin/bookings" className="text-gray-700 hover:text-brand-700">
                  Admin
                </Link>
              )}
              <span className="hidden text-gray-400 sm:inline">|</span>
              <span className="hidden text-gray-600 sm:inline">
                Hi, {session.user.name?.split(" ")[0]}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="btn-secondary !px-3 !py-1.5"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-gray-700 hover:text-brand-700">
                Log in
              </Link>
              <Link href="/register" className="btn-primary !px-4 !py-2">
                Enroll Now
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
