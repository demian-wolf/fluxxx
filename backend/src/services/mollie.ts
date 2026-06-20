/**
 * Mollie integration (backend-architecture.md section 4).
 *
 * Skeleton stubs: the real implementation should call the Mollie REST API
 * (`POST /v2/payments`, `GET /v2/payments/{id}`) using `config.mollie.apiKey`
 * and an idempotency key. Network calls are intentionally omitted here.
 */
import { v4 as uuidv4 } from "uuid";
import { config } from "../config/env";
import { MolliePaymentStatus } from "../types";

export interface CreatePaymentInput {
  amountCents: number;
  description: string;
  /** Idempotency key to guard against duplicate webhook-triggered creates. */
  idempotencyKey?: string;
}

export interface CreatePaymentResult {
  molliePaymentId: string;
  checkoutUrl: string;
  status: MolliePaymentStatus;
  expiresAt: string;
}

export interface RemotePayment {
  id: string;
  status: MolliePaymentStatus;
  amountCents: number;
}

/**
 * Create a Mollie hosted-checkout payment session.
 * TODO: replace stub with real `POST https://api.mollie.com/v2/payments`.
 */
export async function createPayment(
  input: CreatePaymentInput,
): Promise<CreatePaymentResult> {
  const idempotencyKey = input.idempotencyKey ?? uuidv4();
  void idempotencyKey; // forwarded as `Idempotency-Key` header in real impl
  void config.mollie.apiKey;

  const molliePaymentId = "tr_" + uuidv4().replace(/-/g, "").slice(0, 10);
  return {
    molliePaymentId,
    checkoutUrl: `https://www.mollie.com/checkout/${molliePaymentId}`,
    status: MolliePaymentStatus.Open,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
}

/**
 * Re-fetch a payment directly from Mollie to verify a webhook (anti-spoofing).
 * TODO: replace stub with real `GET https://api.mollie.com/v2/payments/{id}`.
 */
export async function getPayment(molliePaymentId: string): Promise<RemotePayment> {
  return {
    id: molliePaymentId,
    status: MolliePaymentStatus.Paid,
    amountCents: 0,
  };
}
