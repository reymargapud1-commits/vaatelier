"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import Logo from "./Logo";

export default function Navbar() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-40 border-b border-brand-100 bg-[#faf6f1]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/">
          <Logo />
        </Link>

        <nav className="flex items-center gap-3 text-sm">
          {session?.user ? (
            <>
              <Link href="/dashboard" className="text-gray-700 hover:text-brand-700">
                Dashboard
              </Link>
              <Link href="/dashboard/booking" className="text-gray-700 hover:text-brand-700">
                Coaching
              </Link>
              <Link href="/dashboard/store" className="text-gray-700 hover:text-brand-700">
                Store
              </Link>
              {(session.user as any).role === "admin" && (
                <>
                  <Link href="/admin/students" className="text-gray-700 hover:text-brand-700">
                    Students
                  </Link>
                  <Link href="/admin/feedback" className="text-gray-700 hover:text-brand-700">
                    Feedback
                  </Link>
                  <Link href="/admin/bookings" className="text-gray-700 hover:text-brand-700">
                    Bookings
                  </Link>
                  <Link href="/admin/store-orders" className="text-gray-700 hover:text-brand-700">
                    Orders
                  </Link>
                  <Link
                    href="/admin/manual-payments"
                    className="text-gray-700 hover:text-brand-700"
                  >
                    Manual Payments
                  </Link>
                </>
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
