/**
 * Webhook / Alert System — pushes event notifications to configured endpoints.
 *
 * Events: oob_kill, gc_sweep, policy_violation, low_balance, agent_spawned,
 *         high_value_approval, agent_revoked
 *
 * Supports webhook URLs (HTTP POST) with HMAC-SHA256 signatures.
 */
import { createHmac } from "crypto";

export type AlertEventType =
  | "oob_kill"
  | "gc_sweep"
  | "policy_violation"
  | "low_balance"
  | "agent_spawned"
  | "high_value_approval"
  | "agent_revoked"
  | "approval_required";

export interface AlertEvent {
  type: AlertEventType;
  timestamp: string;
  walletId: string;
  data: Record<string, unknown>;
}

export interface WebhookConfig {
  id: string;
  url: string;
  secret: string;
  events: AlertEventType[];
  enabled: boolean;
  createdAt: string;
}

export interface AlertDelivery {
  eventType: AlertEventType;
  webhookId: string;
  status: "delivered" | "failed" | "pending";
  statusCode?: number;
  attemptedAt: string;
  error?: string;
}

// In-memory webhook registry (would be DB-backed in production)
const webhookRegistry: WebhookConfig[] = [];
const deliveryLog: AlertDelivery[] = [];

/**
 * Register a new webhook endpoint.
 */
export function registerWebhook(config: Omit<WebhookConfig, "id" | "createdAt">): WebhookConfig {
  const webhook: WebhookConfig = {
    ...config,
    id: `whk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  webhookRegistry.push(webhook);
  return webhook;
}

/**
 * Remove a webhook by ID.
 */
export function removeWebhook(webhookId: string): boolean {
  const idx = webhookRegistry.findIndex((w) => w.id === webhookId);
  if (idx === -1) return false;
  webhookRegistry.splice(idx, 1);
  return true;
}

/**
 * List all registered webhooks.
 */
export function listWebhooks(): WebhookConfig[] {
  return [...webhookRegistry];
}

/**
 * Get delivery history.
 */
export function getDeliveryLog(limit: number = 50): AlertDelivery[] {
  return deliveryLog.slice(-limit);
}

/**
 * Dispatch an alert event to all matching webhooks.
 */
export async function dispatchAlert(event: AlertEvent): Promise<AlertDelivery[]> {
  const matching = webhookRegistry.filter(
    (w) => w.enabled && w.events.includes(event.type),
  );

  const deliveries: AlertDelivery[] = [];

  for (const webhook of matching) {
    const delivery = await deliverToWebhook(webhook, event);
    deliveries.push(delivery);
    deliveryLog.push(delivery);
  }

  return deliveries;
}

/**
 * Deliver a single event to a webhook endpoint.
 */
async function deliverToWebhook(
  webhook: WebhookConfig,
  event: AlertEvent,
): Promise<AlertDelivery> {
  const payload = JSON.stringify({
    event: event.type,
    timestamp: event.timestamp,
    wallet_id: event.walletId,
    data: event.data,
  });

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Flux-Event": event.type,
        "X-Flux-Timestamp": event.timestamp,
        "X-Flux-Signature": computeSignature(payload, webhook.secret),
      },
      body: payload,
      signal: AbortSignal.timeout(10_000),
    });

    return {
      eventType: event.type,
      webhookId: webhook.id,
      status: response.ok ? "delivered" : "failed",
      statusCode: response.status,
      attemptedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      eventType: event.type,
      webhookId: webhook.id,
      status: "failed",
      attemptedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : "unknown_error",
    };
  }
}

/**
 * Compute HMAC-SHA256 signature for webhook payload verification.
 */
function computeSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Helper: emit a low-balance alert when wallet drops below threshold.
 */
export async function checkAndAlertLowBalance(
  walletId: string,
  balanceCents: number,
  thresholdCents: number = 1000,
): Promise<void> {
  if (balanceCents <= thresholdCents) {
    await dispatchAlert({
      type: "low_balance",
      timestamp: new Date().toISOString(),
      walletId,
      data: {
        balance_cents: balanceCents,
        threshold_cents: thresholdCents,
      },
    });
  }
}

/**
 * Helper: emit an OOB kill alert.
 */
export async function alertOobKill(
  walletId: string,
  agentsKilled: number,
  protectedAgent: string | null,
  killedNames: string[],
): Promise<void> {
  await dispatchAlert({
    type: "oob_kill",
    timestamp: new Date().toISOString(),
    walletId,
    data: {
      agents_killed: agentsKilled,
      protected_agent: protectedAgent,
      killed_agent_names: killedNames,
    },
  });
}

/**
 * Helper: emit a policy violation alert.
 */
export async function alertPolicyViolation(
  walletId: string,
  agentId: string,
  agentName: string,
  reason: string,
  amountCents: number,
): Promise<void> {
  await dispatchAlert({
    type: "policy_violation",
    timestamp: new Date().toISOString(),
    walletId,
    data: {
      agent_id: agentId,
      agent_name: agentName,
      rejection_reason: reason,
      requested_amount_cents: amountCents,
    },
  });
}
