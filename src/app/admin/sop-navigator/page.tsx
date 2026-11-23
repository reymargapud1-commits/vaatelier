import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import TelusNavigator from "@/components/TelusNavigator";

/**
 * Admin-only page: PureFibre Call Navigator, a live-call SOP/script
 * reference for Reymar's separate TELUS PureFibre cold-calling client
 * work. Kept here (rather than as a standalone file/link) so it's always
 * one click away from the rest of the admin portal.
 */
export default async function SopNavigatorPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as any).role !== "admin") redirect("/dashboard");

  return (
    <>
      <Navbar />
      <TelusNavigator />
    </>
  );
}
