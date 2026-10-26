import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { staffProfiles } from "@/db/schema";
import Navbar from "@/components/Navbar";

function peso(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

export default async function StaffAgreementPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "staff") redirect("/dashboard");

  const userId = (session.user as any).id;
  const [profile] = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, userId)).limit(1);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link href="/staff" className="mb-4 inline-block text-sm text-brand-700 hover:underline">
          ← Back to Dashboard
        </Link>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Service Agreement</h1>
        <p className="mb-6 text-sm text-gray-600">Your employment terms, as entered by your admin.</p>

        {profile ? (
          <div className="card">
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Position</p>
                <p className="font-medium text-gray-900">{profile.position}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Daily Rate</p>
                <p className="font-medium text-gray-900">{peso(profile.dailyRateCentavos)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Start Date</p>
                <p className="font-medium text-gray-900">
                  {profile.startDate.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
            </div>

            <div className="mb-5 whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
              {profile.serviceAgreement || "No specific terms have been entered yet - contact your admin."}
            </div>

            <a
              href={`/api/staff/agreement/${userId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              Download PDF
            </a>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No profile set up yet - contact your admin.</p>
        )}
      </main>
    </>
  );
}
