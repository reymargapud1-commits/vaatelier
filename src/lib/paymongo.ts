import crypto from "crypto";

const PAYMONGO_API = "https://api.paymongo.com/v1";

function authHeader() {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) {
    throw new Error("PAYMONGO_SECRET_KEY is not set. Add it to your .env file.");
  }
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

export interface CreateCheckoutParams {
  amountCentavos: number;
  description: string;
  userEmail: string;
  userName: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
  /** Extra metadata merged alongside userId - used to tag what a checkout is
   * for (purpose, referenceId) so the webhook can route it correctly even
   * as a fallback if the payments row lookup somehow misses. */
  metadata?: Record<string, string>;
}

/**
 * Creates a PayMongo Checkout Session that supports GCash, Maya (PayMaya),
 * and card payments. Docs: https://docs.paymongo.com/reference/checkout-session-resource
 */
export async function createCheckoutSession(params: CreateCheckoutParams) {
  const body = {
    data: {
      attributes: {
        line_items: [
          {
            name: params.description,
            amount: params.amountCentavos,
            currency: "PHP",
            quantity: 1,
          },
        ],
        payment_method_types: ["gcash", "paymaya", "card"],
        billing: {
          name: params.userName,
          email: params.userEmail,
        },
        description: params.description,
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        send_email_receipt: true,
        show_line_items: true,
        show_description: true,
        metadata: {
          userId: params.userId,
          ...params.metadata,
        },
      },
    },
  };

  const res = await fetch(`${PAYMONGO_API}/checkout_sessions`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`PayMongo checkout session creation failed (${res.status}): ${errText}`);
  }

  const json = await res.json();
  return json.data as {
    id: string;
    attributes: { checkout_url: string; payment_intent?: { id: string } };
  };
}

/**
 * Retrieves a checkout session's current status directly from PayMongo.
 * Used as a fallback right after redirect, in case the webhook (which is
 * the primary source of truth) hasn't arrived yet - handy in local dev
 * where PayMongo can't reach http://localhost.
 */
export async function retrieveCheckoutSession(checkoutSessionId: string) {
  const res = await fetch(`${PAYMONGO_API}/checkout_sessions/${checkoutSessionId}`, {
    headers: { Authorization: authHeader() },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`PayMongo retrieve checkout session failed (${res.status}): ${errText}`);
  }
  const json = await res.json();
  return json.data as {
    id: string;
    attributes: { payment_intent?: { attributes?: { status?: string } }; payments?: any[] };
  };
}

/**
 * Verifies a PayMongo webhook request signature.
 * Docs: https://docs.paymongo.com/docs/developer-tools-webhook-setup-management
 *
 * Header format: "t=<timestamp>,te=<test_signature>,li=<live_signature>"
 * Signed payload: `${timestamp}.${rawBody}`, HMAC-SHA256 with the webhook secret.
 */
export function verifyPaymongoWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
  useLive = false
): boolean {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key.trim(), value?.trim()];
    })
  );

  const timestamp = parts["t"];
  const providedSignature = useLive ? parts["li"] : parts["te"];
  if (!timestamp || !providedSignature) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(signedPayload)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(providedSignature, "hex")
    );
  } catch {
    return false;
  }
}
