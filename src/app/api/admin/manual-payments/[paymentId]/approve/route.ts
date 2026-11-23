import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { markPaymentPaid } from "@/lib/payment-fulfillment";

export async function POST(req: Request, { params }: { params: { paymentId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const paymentId = params.paymentId.replace(/[^a-zA-Z0-9-]/g, "");
  const result = await markPaymentPaid(paymentId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Could not approve this payment." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
