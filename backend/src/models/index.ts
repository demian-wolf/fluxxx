/**
 * Entity interfaces for FLUX (backend-architecture.md section 1).
 *
 * In production these map to Base44 entities; in this skeleton they are plain
 * TypeScript interfaces backed by the in-memory store in `src/store`.
 */
import {
  UUID,
  Currency,
  WalletStatus,
  AgentStatus,
  LedgerEntryType,
  LedgerEntryStatus,
  MolliePaymentStatus,
  TransactionDecision,
  RejectionReason,
  PolicyRules,
} from "../types";

/** 1.1 Human operator who funds wallets and sets policies. */
export interface User {
  id: UUID;
  email: string;
  full_name: string;
  mollie_customer_id: string | null;
  created_at: string;
}

/** 1.2 Funded virtual account backing one or more agents. */
export interface AgentWallet {
  id: UUID;
  owner_id: UUID;
  name: string;
  /** Cached projection of the append-only ledger; never edited directly. */
  balance_cents: number;
  currency: Currency;
  status: WalletStatus;
  created_at: string;
  updated_at: string;
}

/** 1.3 Know-Your-Agent registry record. */
export interface AgentIdentity {
  id: UUID;
  wallet_id: UUID;
  owner_id: UUID;
  name: string;
  /** SHA-256 hash of the agent's secret API key. Raw key is never stored. */
  api_key_hash: string;
  status: AgentStatus;
  hourly_limit_cents: number;
  per_tx_limit_cents: number;
  daily_limit_cents: number;
  allowed_domains: string[];
  created_at: string;
  last_seen_at: string | null;
}

/** 1.4 Versioned policy rules attached to an agent. */
export interface SpendPolicy {
  id: UUID;
  agent_id: UUID;
  version: number;
  rules: PolicyRules;
  is_active: boolean;
  created_by: UUID;
  created_at: string;
}

/** 1.5 Append-only financial log. Never updated or deleted. */
export interface LedgerEntry {
  id: UUID;
  wallet_id: UUID;
  agent_id: UUID | null;
  type: LedgerEntryType;
  amount_cents: number;
  balance_after_cents: number;
  description: string;
  payee_url: string | null;
  mollie_payment_id: string | null;
  payment_token: string | null;
  status: LedgerEntryStatus;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** 1.6 Tracks Mollie deposit sessions initiated by the operator. */
export interface MolliePayment {
  id: UUID;
  user_id: UUID;
  wallet_id: UUID;
  mollie_payment_id: string;
  amount_cents: number;
  currency: Currency;
  method: string;
  status: MolliePaymentStatus;
  checkout_url: string;
  webhook_received_at: string | null;
  created_at: string;
}

/** 1.7 Every agent payment attempt evaluated by the policy engine. */
export interface TransactionRequest {
  id: UUID;
  agent_id: UUID;
  wallet_id: UUID;
  requested_amount_cents: number;
  payee_url: string;
  description: string;
  decision: TransactionDecision;
  rejection_reason: RejectionReason | null;
  payment_token: string | null;
  token_expires_at: string | null;
  ledger_entry_id: UUID | null;
  created_at: string;
}
