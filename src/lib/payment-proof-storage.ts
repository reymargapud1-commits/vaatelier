import fs from "fs";
import path from "path";

/**
 * Where manual-GCash proof-of-payment screenshots are stored on disk.
 *
 * These are uploaded at RUNTIME (after a deploy), so - exactly like the
 * SQLite database file itself (see db/index.ts) - they need to live on
 * whatever persistent volume the host actually mounts, not just anywhere
 * under the app's working directory. A plain `media/` folder would get
 * wiped on the next deploy on a host like Railway unless it happens to be
 * covered by the same mount as the database.
 *
 * Rather than guess or hardcode a volume path, this stores proofs as a
 * SIBLING of the database file itself (e.g. DATABASE_URL=file:/data/prod.db
 * -> /data/payment-proofs/) - guaranteeing the same persistence guarantee
 * the database already relies on, whatever that mount path turns out to be.
 */
export function getPaymentProofDir(): string {
  const dbPath = process.env.DATABASE_URL?.replace(/^file:/, "") || "dev.db";
  const dir = path.join(path.dirname(path.resolve(dbPath)), "payment-proofs");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function paymentProofPath(paymentId: string, ext: string): string {
  const safeId = paymentId.replace(/[^a-zA-Z0-9-]/g, "");
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "jpg";
  return path.join(getPaymentProofDir(), `${safeId}.${safeExt}`);
}

/** Finds the actual saved file for a payment, trying common image extensions. */
export function findPaymentProofFile(paymentId: string): string | null {
  const safeId = paymentId.replace(/[^a-zA-Z0-9-]/g, "");
  const dir = getPaymentProofDir();
  for (const ext of ["jpg", "jpeg", "png", "webp", "gif"]) {
    const p = path.join(dir, `${safeId}.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
