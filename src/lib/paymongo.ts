import crypto from "crypto";

// PayMongo Checkout Sessions API - https://developers.paymongo.com/reference/the-checkout-session-object
// Secret key auth is HTTP Basic with the secret key as the username and an
// empty password. Use sk_test_... while developing, sk_live_... in
// production (see README "Configure your .env").
const PAYMONGO_API = "https://api.paymongo.com/v1";

function authHeader(): string {
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) {
    throw new Error("PAYMONGO_SECRET_KEY is not set.");
  }
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

async function paymongoRequest(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${PAYMONGO_API}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json?.errors?.[0]?.detail || `PayMongo request failed (${res.status}).`;
    throw new Error(message);
  }
  return json;
}

/**
 * Starts a PayMongo Checkout Session (GCash, Maya, card) for one of this
 * app's three payment purposes (enrollment / coaching / store_order - see
 * `metadata.purpose` + `metadata.referenceId`, read back by the webhook).
 * `metadata.userId` is always included too so the webhook can fall back to
 * it if the payments row lookup by checkoutSessionId somehow misses.
 */
export async function createCheckoutSession(params: {
  amountCentavos: number;
  description: string;
  userEmail: string;
  userName: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}) {
  const { amountCentavos, description, userEmail, userName, userId, successUrl, cancelUrl, metadata } = params;

  const json = await paymongoRequest("/checkout_sessions", {
    method: "POST",
    body: JSON.stringify({
      data: {
        attributes: {
          billing: { name: userName, email: userEmail },
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          line_items: [
            {
              currency: "PHP",
              amount: amountCentavos,
              name: description,
              quantity: 1,
            },
          ],
          payment_method_types: ["gcash", "paymaya", "card"],
          description,
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: { userId, ...(metadata || {}) },
        },
      },
    }),
  });

  return json.data;
}

/**
 * Fallback verification path for /payment/success (see
 * api/payment/verify/route.ts and its booking/order siblings): looks up a
 * checkout session's current status directly, for when the webhook hasn't
 * landed yet (e.g. local dev without a public tunnel).
 */
export async function retrieveCheckoutSession(checkoutSessionId: string) {
  const json = await paymongoRequest(`/checkout_sessions/${checkoutSessionId}`, { method: "GET" });
  return json.data;
}

/**
 * Verifies the `Paymongo-Signature` webhook header (HMAC-SHA256). The
 * header looks like `t=<timestamp>,te=<test_signature>,li=<live_signature>`
 * - the signed payload is `${timestamp}.${rawBody}`, and which signature to
 * check (test vs live) depends on whether PAYMONGO_SECRET_KEY is a
 * sk_live_ key. Never skip this check - it's the only thing standing
 * between this endpoint and anyone on the internet claiming a payment
 * succeeded.
 */
export function verifyPaymongoWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
  isLive: boolean
): boolean {
  if (!signatureHeader) return false;

  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(",")) {
    const [key, value] = part.split("=");
    if (key && value) parts[key.trim()] = value.trim();
  }

  const timestamp = parts.t;
  const expectedSignature = isLive ? parts.li : parts.te;
  if (!timestamp || !expectedSignature) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const computedSignature = crypto.createHmac("sha256", webhookSecret).update(signedPayload).digest("hex");

  const computedBuf = Buffer.from(computedSignature, "utf8");
  const expectedBuf = Buffer.from(expectedSignature, "utf8");
  if (computedBuf.length !== expectedBuf.length) return false;

  try {
    return crypto.timingSafeEqual(computedBuf, expectedBuf);
  } catch {
    return false;
  }
}
