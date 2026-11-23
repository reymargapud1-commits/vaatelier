import { NextResponse } from "next/server";
import fs from "fs";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { findPaymentProofFile } from "@/lib/payment-proof-storage";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

/**
 * Serves a manual-GCash proof-of-payment screenshot. These live outside
 * /public on purpose (they can show personal payment/account details) - the
 * only way to view one is here, and only the student who uploaded it or an
 * admin may do so. Used both by <img> tags in a student's own payment
 * status view and on /admin/manual-payments.
 */
export async function GET(req: Request, { params }: { params: { paymentId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const paymentId = params.paymentId.replace(/[^a-zA-Z0-9-]/g, "");
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment) {
    return new NextResponse("Not found", { status: 404 });
  }

  const userId = (session.user as any).id;
  const isAdmin = (session.user as any).role === "admin";
  if (payment.userId !== userId && !isAdmin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const filePath = findPaymentProofFile(paymentId);
  if (!filePath) {
    return new NextResponse("Proof image missing", { status: 404 });
  }

  const ext = filePath.split(".").pop()?.toLowerCase() || "jpg";
  const bytes = fs.readFileSync(filePath);
  return new NextResponse(bytes as any, {
    status: 200,
    headers: {
      "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "private, no-store",
    },
  });
}
