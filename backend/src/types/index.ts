/**
 * Shared domain types and enums for FLUX.
 * Mirrors the entities described in backend-architecture.md (section 1).
 */

export type UUID = string;

export type Currency = "EUR";

export enum WalletStatus {
  Active = "active",
  Suspended = "suspended",
  Depleted = "depleted",
}

export enum AgentStatus {
  Active = "active",
  Suspended = "suspended",
  Revoked = "revoked",
}

export enum LedgerEntryType {
  Deposit = "deposit",
  Spend = "spend",
  Refund = "refund",
  Hold = "hold",
  Release = "release",
}

export enum LedgerEntryStatus {
  Pending = "pending",
  Settled = "settled",
  Failed = "failed",
  Reversed = "reversed",
}

export enum MolliePaymentStatus {
  Open = "open",
  Pending = "pending",
  Paid = "paid",
  Failed = "failed",
  Expired = "expired",
}

export enum TransactionDecision {
  Pending = "pending",
  Approved = "approved",
  Rejected = "rejected",
}

/**
 * Reason codes emitted by the policy engine on rejection.
 * See backend-architecture.md section 3 (state machine).
 */
export enum RejectionReason {
  AgentSuspended = "agent_suspended",
  PerTxLimitExceeded = "per_tx_limit_exceeded",
  HourlyLimitExceeded = "hourly_limit_exceeded",
  DailyLimitExceeded = "daily_limit_exceeded",
  InsufficientBalance = "insufficient_balance",
  DomainBlocked = "domain_blocked",
  MissingDescription = "missing_description",
}

/** Structured policy rule set stored on SpendPolicy.rules (JSON). */
export interface PolicyRules {
  hourly_limit_cents: number;
  per_tx_limit_cents: number;
  daily_limit_cents: number;
  allowed_categories?: string[];
  blocked_domains?: string[];
  require_description?: boolean;
  auto_suspend_on_anomaly?: boolean;
}
