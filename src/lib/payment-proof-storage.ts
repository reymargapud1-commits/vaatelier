import fs from "fs";
import path from "path";

/**
 * Manual-GCash proof-of-payment screenshots live outside /public (they can
 * show personal payment/account details - only the uploading student or an
 * admin may view one, via /api/payment-proof/[paymentId]) and outside the
 * project directory, next to the SQLite database file rather than in it,
 * because on a host like Railway only the database's own persistent Volume
 * is guaranteed to survive a redeploy. See README "Manual GCash payments".
 */
function proofsDir(): string {
  const dbPath = process.env.DATABASE_URL?.replace(/^file:/, "") || "dev.db";
  const dir = path.dirname(path.resolve(dbPath));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Full filesystem path to write a newly-uploaded proof screenshot to. */
export function paymentProofPath(paymentId: string, ext: string): string {
  const safeId = paymentId.replace(/[^a-zA-Z0-9-]/g, "");
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "");
  return path.join(proofsDir(), `${safeId}.${safeExt}`);
}

/**
 * Finds an already-uploaded proof screenshot for a payment, whatever
 * extension it was saved with (the payments row only tracks the filename
 * for display - this is the actual on-disk lookup used to serve it).
 * Returns null if nothing has been uploaded for this payment yet.
 */
export function findPaymentProofFile(paymentId: string): string | null {
  const safeId = paymentId.replace(/[^a-zA-Z0-9-]/g, "");
  const dir = proofsDir();
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return null;
  }
  const match = entries.find(
    (f) => f.startsWith(`${safeId}.`) && /\.(jpg|jpeg|png|webp|gif)$/i.test(f)
  );
  return match ? path.join(dir, match) : null;
}
