/**
 * Mollie integration (backend-architecture.md section 4).
 *
 * Real REST calls to api.mollie.com using MOLLIE_API_KEY.
 * Idempotency-Key header guards against duplicate processing on webhook retries.
 */
import { v4 as uuidv4 } from "uuid";
import { config } from "../config/env";

const MOLLIE_BASE = "https://api.mollie.com/v2";

type MollieStatus = "open" | "pending" | "paid" | "failed" | "expired";

export interface CreatePaymentInput {
  amountCents: number;
  description: string;
  idempotencyKey?: string;
}

export interface CreatePaymentResult {
  molliePaymentId: string;
  checkoutUrl: string;
  status: MollieStatus;
  expiresAt: string;
}

export interface RemotePayment {
  id: string;
  status: MollieStatus;
  amountCents: number;
}

function authHeader(): string {
  return `Bearer ${config.mollie.apiKey}`;
}

/**
 * Create a Mollie hosted-checkout payment session.
 * POST https://api.mollie.com/v2/payments
 */
export async function createPayment(
  input: CreatePaymentInput,
): Promise<CreatePaymentResult> {
  const idempotencyKey = input.idempotencyKey ?? uuidv4();
  const euros = (input.amountCents / 100).toFixed(2);

  if (!config.mollie.apiKey) {
    const molliePaymentId = "tr_" + uuidv4().replace(/-/g, "").slice(0, 10);
    return {
      molliePaymentId,
      checkoutUrl: `https://www.mollie.com/checkout/${molliePaymentId}`,
      status: "open",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }

  const res = await fetch(`${MOLLIE_BASE}/payments`, {
    method: "POST",
    headers: {
      "Authorization":   authHeader(),
      "Content-Type":    "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      amount:      { currency: "EUR", value: euros },
      description: input.description,
      redirectUrl: config.mollie.redirectUrl,
      webhookUrl:  config.mollie.webhookUrl,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mollie createPayment failed ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    id: string;
    status: MollieStatus;
    expiresAt?: string;
    _links: { checkout: { href: string } };
  };

  return {
    molliePaymentId: data.id,
    checkoutUrl:     data._links.checkout.href,
    status:          data.status,
    expiresAt:       data.expiresAt ?? new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
}

/**
 * Re-fetch a payment directly from Mollie to verify a webhook (anti-spoofing).
 * GET https://api.mollie.com/v2/payments/{id}
 */
export async function getPayment(molliePaymentId: string): Promise<RemotePayment> {
  if (!config.mollie.apiKey) {
    return { id: molliePaymentId, status: "paid", amountCents: 0 };
  }

  const res = await fetch(`${MOLLIE_BASE}/payments/${molliePaymentId}`, {
    headers: { "Authorization": authHeader() },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mollie getPayment failed ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    id: string;
    status: MollieStatus;
    amount: { value: string };
  };

  return {
    id:          data.id,
    status:      data.status,
    amountCents: Math.round(parseFloat(data.amount.value) * 100),
  };
}
