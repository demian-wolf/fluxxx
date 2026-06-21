/**
 * Mollie integration using the official @mollie/api-client.
 *
 * Falls back to a deterministic stub when MOLLIE_API_KEY is empty so the
 * payment flow can be exercised locally without a real Mollie account.
 */
import { v4 as uuidv4 } from "uuid";
import createMollieClient from "@mollie/api-client";
import { eq } from "drizzle-orm";
import { config } from "../config/env";
import { db } from "../db";
import { agentWalletsTable, molliePaymentsTable } from "../db/schema";
import { writeLedgerEntry } from "./ledger";

export type MollieStatus = "open" | "pending" | "paid" | "failed" | "expired";
export type MollieMethod = "ideal" | "creditcard" | "bancontact" | "banktransfer" | "paypal";

export const SUPPORTED_METHODS: MollieMethod[] = [
  "ideal",
  "creditcard",
  "bancontact",
  "banktransfer",
  "paypal",
];

export interface CreatePaymentInput {
  amountCents: number;
  description: string;
  method?: MollieMethod;
  idempotencyKey?: string;
  redirectUrl?: string;
  webhookUrl?: string;
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

function mollieClient() {
  return createMollieClient({ apiKey: config.mollie.apiKey });
}

function euros(cents: number): string {
  return (cents / 100).toFixed(2);
}

function defaultRedirectUrl(): string {
  const base = config.flux.appUrl || config.mollie.redirectUrl;
  if (!base) throw new Error("FLUX_APP_URL or MOLLIE_REDIRECT_URL is required");
  return `${base.replace(/\/$/, "")}/payments/success`;
}

function defaultWebhookUrl(): string {
  const base = config.flux.appUrl || config.mollie.webhookUrl;
  if (!base) throw new Error("FLUX_APP_URL or MOLLIE_WEBHOOK_URL is required");
  return `${base.replace(/\/$/, "")}/api/webhooks/mollie`;
}

export function isValidMethod(method: string): method is MollieMethod {
  return SUPPORTED_METHODS.includes(method as MollieMethod);
}

/**
 * Create a Mollie hosted-checkout payment session.
 * Falls back to a stub when MOLLIE_API_KEY is empty.
 */
export async function createPayment(
  input: CreatePaymentInput,
): Promise<CreatePaymentResult> {
  const molliePaymentId = `tr_${uuidv4().replace(/-/g, "").slice(0, 10)}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  if (!config.mollie.apiKey) {
    return {
      molliePaymentId,
      checkoutUrl: `${defaultRedirectUrl()}?mock_payment_id=${molliePaymentId}`,
      status: "open",
      expiresAt,
    };
  }

  const payment = await mollieClient().payments.create({
    amount:      { currency: "EUR", value: euros(input.amountCents) },
    description: input.description,
    redirectUrl: input.redirectUrl || defaultRedirectUrl(),
    webhookUrl:  input.webhookUrl || defaultWebhookUrl(),
    metadata:    { idempotencyKey: input.idempotencyKey ?? uuidv4() },
    method:      input.method as never,
  });

  return {
    molliePaymentId: payment.id,
    checkoutUrl:     payment.getCheckoutUrl() ?? `${defaultRedirectUrl()}?payment=${payment.id}`,
    status:          payment.status as MollieStatus,
    expiresAt:       payment.expiresAt ?? expiresAt,
  };
}

/**
 * Re-fetch a payment directly from Mollie to verify a webhook (anti-spoofing).
 * Falls back to a stub when MOLLIE_API_KEY is empty.
 */
export async function getPayment(molliePaymentId: string): Promise<RemotePayment> {
  if (!config.mollie.apiKey) {
    return { id: molliePaymentId, status: "paid", amountCents: 0 };
  }

  const payment = await mollieClient().payments.get(molliePaymentId);

  return {
    id:          payment.id,
    status:      payment.status as MollieStatus,
    amountCents: Math.round(parseFloat(payment.amount.value) * 100),
  };
}

/**
 * Record the final status of a Mollie payment and, if paid, credit the wallet.
 * Used by the real webhook handler and by the mock payment simulator.
 */
export async function processPaymentUpdate(
  molliePaymentId: string,
  remoteStatus: MollieStatus,
): Promise<{ processed: boolean; status: MollieStatus }> {
  const [record] = await db
    .select()
    .from(molliePaymentsTable)
    .where(eq(molliePaymentsTable.molliePaymentId, molliePaymentId))
    .limit(1);

  if (!record) {
    return { processed: false, status: remoteStatus };
  }

  const now = new Date();

  if (remoteStatus === "paid" && record.status !== "paid") {
    const [wallet] = await db
      .select({ id: agentWalletsTable.id, balanceCents: agentWalletsTable.balanceCents })
      .from(agentWalletsTable)
      .where(eq(agentWalletsTable.id, record.walletId))
      .limit(1);

    if (wallet) {
      await writeLedgerEntry({
        walletId:           wallet.id,
        walletBalanceCents: wallet.balanceCents,
        agentId:            null,
        type:               "deposit",
        amountCents:        record.amountCents,
        description:        "Mollie deposit",
        molliePaymentId,
      });
    }

    await db
      .update(molliePaymentsTable)
      .set({ status: "paid", webhookReceivedAt: now })
      .where(eq(molliePaymentsTable.id, record.id));
  } else if (remoteStatus === "failed" || remoteStatus === "expired") {
    await db
      .update(molliePaymentsTable)
      .set({ status: remoteStatus, webhookReceivedAt: now })
      .where(eq(molliePaymentsTable.id, record.id));
  } else {
    await db
      .update(molliePaymentsTable)
      .set({ webhookReceivedAt: now })
      .where(eq(molliePaymentsTable.id, record.id));
  }

  return { processed: true, status: remoteStatus };
}
