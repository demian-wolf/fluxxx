// Domain types mirroring the FLUX backend entities and API contracts described
// in backend-architecture.md. All monetary values are integer euro cents.

export type ISODateString = string;

export type WalletStatus = "active" | "suspended" | "depleted";
export type AgentStatus = "active" | "suspended" | "revoked";
export type LedgerType = "deposit" | "spend" | "refund" | "hold" | "release";
export type LedgerStatus = "pending" | "settled" | "failed" | "reversed";
export type TxDecision = "pending" | "approved" | "rejected";
export type MollieStatus = "open" | "pending" | "paid" | "failed" | "expired";
export type PaymentMethod = "ideal" | "creditcard" | "bancontact" | "banktransfer";

export interface User {
  id: string;
  email: string;
  full_name: string;
  mollie_customer_id: string | null;
  created_at: ISODateString;
}

export interface AgentWallet {
  id: string;
  owner_id: string;
  name: string;
  balance_cents: number;
  currency: string;
  status: WalletStatus;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export interface PolicyRules {
  hourly_limit_cents: number;
  per_tx_limit_cents: number;
  daily_limit_cents: number;
  allowed_categories?: string[];
  allowed_domains?: string[];
  blocked_domains?: string[];
  require_description?: boolean;
  auto_suspend_on_anomaly?: boolean;
  can_spawn?: boolean;
}

export interface AgentIdentity {
  id: string;
  wallet_id: string;
  owner_id: string;
  parent_id: string | null;
  name: string;
  api_key_preview: string; // last 4 chars, never the full key
  status: AgentStatus;
  hourly_limit_cents: number;
  per_tx_limit_cents: number;
  daily_limit_cents: number;
  allowed_domains: string[];
  blocked_domains: string[];
  created_at: ISODateString;
  last_seen_at: ISODateString | null;
}

export interface SpendPolicy {
  id: string;
  agent_id: string;
  version: number;
  rules: PolicyRules;
  is_active: boolean;
  created_by: string;
  created_at: ISODateString;
}

export interface LedgerEntry {
  id: string;
  wallet_id: string;
  agent_id: string | null;
  agent_name: string | null;
  type: LedgerType;
  amount_cents: number;
  balance_after_cents: number;
  description: string;
  payee_url: string | null;
  mollie_payment_id: string | null;
  payment_token: string | null;
  status: LedgerStatus;
  category?: string | null;
  metadata?: Record<string, unknown>;
  created_at: ISODateString;
}

export interface MolliePayment {
  id: string;
  user_id: string;
  wallet_id: string;
  mollie_payment_id: string;
  amount_cents: number;
  currency: string;
  method: PaymentMethod;
  status: MollieStatus;
  checkout_url: string;
  webhook_received_at: ISODateString | null;
  created_at: ISODateString;
}

export interface PolicyCheck {
  rule: string;
  label: string;
  passed: boolean;
}

export interface TransactionRequest {
  id: string;
  agent_id: string;
  agent_name: string;
  wallet_id: string;
  wallet_name: string;
  requested_amount_cents: number;
  payee_url: string;
  description: string;
  category: string | null;
  decision: TxDecision;
  rejection_reason: string | null;
  payment_token: string | null;
  token_expires_at: ISODateString | null;
  token_used_at: ISODateString | null;
  ledger_entry_id: string | null;
  balance_before_cents: number;
  balance_after_cents: number | null;
  policy_checks: PolicyCheck[];
  created_at: ISODateString;
}

// ----- API response shapes -----

export interface AuthResponse {
  user: User;
  session_token: string;
}

export interface AgentAnalytics {
  agent_id: string;
  name: string;
  status: AgentStatus;
  spent_last_hour_cents: number;
  spent_today_cents: number;
  hourly_limit_cents: number;
  daily_limit_cents: number;
  per_tx_limit_cents: number;
  transaction_count: number;
  last_tx_at: ISODateString | null;
  last_seen_at: ISODateString | null;
}

export interface WalletAnalytics {
  wallet_id: string;
  balance_cents: number;
  total_deposited_cents: number;
  total_spent_cents: number;
  agents: AgentAnalytics[];
  recent_transactions: LedgerEntry[];
}

export interface RegisterAgentInput {
  wallet_id: string;
  parent_id?: string | null;
  name: string;
  hourly_limit_cents: number;
  per_tx_limit_cents: number;
  daily_limit_cents: number;
  allowed_domains?: string[];
  blocked_domains?: string[];
}

export interface RegisterAgentResponse {
  agent: AgentIdentity;
  api_key: string;
  warning: string;
}

export interface SpawnAgentInput {
  name: string;
  hourly_limit_cents?: number;
  per_tx_limit_cents?: number;
  daily_limit_cents: number;
  allowed_domains?: string[];
}

export interface SpawnAgentResponse {
  agent_id: string;
  parent_id: string;
  api_key: string;
  wallet_id: string;
  limits: {
    hourly_limit_cents: number;
    per_tx_limit_cents: number;
    daily_limit_cents: number;
  };
  allowed_domains: string[];
  warning: string;
}

export interface CreateDepositInput {
  wallet_id: string;
  amount_cents: number;
  method: PaymentMethod;
}

export interface CreateDepositResponse {
  mollie_payment_id: string;
  checkout_url: string;
  expires_at: ISODateString;
}

export interface SpendPoint {
  // hourly bucket
  label: string;
  ts: ISODateString;
  spent_cents: number;
}
