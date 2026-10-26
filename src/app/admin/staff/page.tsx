import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { users, staffProfiles } from "@/db/schema";
import Navbar from "@/components/Navbar";

function peso(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

/**
 * Admin-only: the Personal VA / Staff module's home. Built for one staff
 * member today, but flexible - "Add Staff" below creates another full
 * account (login + time keeping + payroll) with no code changes needed.
 */
export default async function AdminStaffPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "admin") redirect("/dashboard");

  const staffUsers = await db.select().from(users).where(eq(users.role, "staff")).orderBy(desc(users.createdAt));
  const profiles = await db.select().from(staffProfiles);
  const profileByUserId = new Map(profiles.map((p) => [p.userId, p]));

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Staff</h1>
        <p className="mb-8 text-sm text-gray-600">
          Your own employee(s) - time keeping, payroll, payslips, cash advances, and their service
          agreement. Separate from both the training portal's students and your personal-client
          billing tools.
        </p>

        <div className="mb-10 space-y-4">
          {staffUsers.length === 0 && <p className="text-gray-500">No staff accounts yet - add your first one below.</p>}
          {staffUsers.map((s) => {
            const profile = profileByUserId.get(s.id);
            return (
              <Link
                key={s.id}
                href={`/admin/staff/${s.id}`}
                className="card block transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-gray-900">
                      {s.name}
                      {profile && !profile.active && (
                        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          Inactive
                        </span>
                      )}
                    </h2>
                    <p className="text-sm text-gray-500">{profile?.position || "Virtual Assistant"}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {profile ? `${peso(profile.dailyRateCentavos)}/day` : "No profile set up"} · {s.email}
                    </p>
                  </div>
                  <span className="text-sm text-brand-700">View →</span>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="card">
          <h2 className="mb-4 font-bold text-gray-900">Add Staff</h2>
          <form action="/api/admin/staff" method="POST" className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Full Name</label>
                <input name="name" required className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Position</label>
                <input name="position" className="input" placeholder="e.g. Virtual Assistant" defaultValue="Virtual Assistant" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Email (their login)</label>
                <input name="email" type="email" required className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Password (their login)</label>
                <input name="password" type="password" required minLength={8} className="input" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Daily Rate (₱)</label>
                <input name="dailyRate" type="number" step="0.01" min="0" required className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Start Date</label>
                <input name="startDate" type="date" className="input" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Service Agreement (optional - can add later)</label>
              <textarea
                name="serviceAgreement"
                rows={4}
                className="input"
                placeholder="Employment terms, scope of work, work hours, confidentiality, etc."
              />
            </div>
            <button type="submit" className="btn-primary">
              Add Staff
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
