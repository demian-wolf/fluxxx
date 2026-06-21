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

// ----- Capital Reclamation (Agentic GC) -----

export type GcReason = "ttl_expired" | "agent_revoked" | "agent_suspended" | "parent_terminated";

export interface GcEvent {
  id: string;
  agent_id: string;
  wallet_id: string;
  reason: GcReason;
  reclaimed_cents: number;
  daily_limit_freed: number;
  refund_ledger_entry_id: string | null;
  agent_name: string;
  parent_agent_id: string | null;
  created_at: ISODateString;
}

export interface GcStatus {
  total_events: number;
  total_reclaimed_cents: number;
  total_limit_freed: number;
  last_sweep_at: ISODateString | null;
}

export interface SweepResult {
  zombies_found: number;
  events_created: number;
  total_reclaimed_cents: number;
  total_limit_freed: number;
  events: GcEvent[];
}

// ----- Monetization / Billing -----

export type SaasTier = "free" | "pro" | "enterprise";

export interface SaasPlan {
  tier: SaasTier;
  label: string;
  price_cents_monthly: number;
  tx_fee_bps: number; // basis points (100 = 1%)
  max_wallets: number | null; // null = unlimited
  max_agents: number | null;
  max_monthly_volume_cents: number | null;
  features: string[];
}

export interface BillingAccount {
  id: string;
  user_id: string;
  tier: SaasTier;
  tx_fee_bps: number;
  current_period_start: ISODateString;
  current_period_end: ISODateString;
  monthly_volume_cents: number;
  total_fees_collected_cents: number;
  total_transactions_billed: number;
  created_at: ISODateString;
}

export interface FeeEvent {
  id: string;
  transaction_id: string;
  agent_name: string;
  gross_amount_cents: number;
  fee_bps: number;
  fee_cents: number;
  net_amount_cents: number;
  created_at: ISODateString;
}

export type ProviderStatus = "pending" | "verified" | "suspended";

export interface MarketplaceProvider {
  id: string;
  name: string;
  domain: string;
  status: ProviderStatus;
  verification_fee_cents: number;
  total_verifications: number;
  total_revenue_cents: number;
  api_key_preview: string;
  created_at: ISODateString;
}

export interface ProviderStats {
  total_providers: number;
  verified_providers: number;
  total_verification_revenue_cents: number;
  pending_verifications: number;
}

export type LicenseStatus = "active" | "expired" | "trial";

export interface WhiteLabelLicense {
  id: string;
  platform: string;
  contact_email: string;
  status: LicenseStatus;
  monthly_fee_cents: number;
  api_calls_this_month: number;
  api_call_limit: number | null;
  issued_at: ISODateString;
  expires_at: ISODateString;
}

export interface LicensingStats {
  total_licenses: number;
  active_licenses: number;
  total_monthly_revenue_cents: number;
  total_api_calls: number;
}

// ----- Out-of-Budget (OOB) Killer -----

export interface OobKillEvent {
  id: string;
  wallet_id: string;
  trigger_balance_cents: number;
  threshold_cents: number;
  agents_killed: number;
  tokens_invalidated: number;
  protected_agent_id: string | null;
  protected_agent_name: string | null;
  killed_agent_ids: string[];
  killed_agent_names: string[];
  created_at: ISODateString;
}

export interface OobStatus {
  total_events: number;
  total_agents_killed: number;
  total_tokens_invalidated: number;
  last_triggered_at: ISODateString | null;
}

export interface OobSimulateResult {
  triggered: boolean;
  wallet_id: string;
  balance_cents: number;
  threshold_cents: number;
  agents_killed: number;
  tokens_invalidated: number;
  protected_agent_id: string | null;
  protected_agent_name: string | null;
  killed_agent_names: string[];
  event: OobKillEvent | null;
}

// ----- Budget Forecasting -----

export interface BurnRate {
  centsPerHour: number;
  centsPerDay: number;
  windowHours: number;
}

export interface AgentBurnRate {
  agentId: string;
  agentName: string;
  centsPerHour: number;
  percentOfTotal: number;
}

export interface DepletionForecast {
  walletId: string;
  balanceCents: number;
  burnRate: BurnRate;
  depletesAt: ISODateString | null;
  hoursRemaining: number | null;
  oobThresholdCents: number;
  hitsOobAt: ISODateString | null;
  hoursUntilOob: number | null;
  confidence: "high" | "medium" | "low";
  agentBurnRates: AgentBurnRate[];
}

// ----- Agent Reputation -----

export type ReputationGrade = "A" | "B" | "C" | "D" | "F";
export type ReputationTrend = "improving" | "stable" | "declining";

export interface ReputationBreakdown {
  approvalRate: number;
  approvalRateScore: number;
  complianceScore: number;
  activityScore: number;
  incidentScore: number;
  totalTransactions: number;
  rejectedTransactions: number;
  oobKills: number;
  gcReclamations: number;
}

export interface ReputationScore {
  agentId: string;
  agentName: string;
  score: number;
  grade: ReputationGrade;
  breakdown: ReputationBreakdown;
  trend: ReputationTrend;
  lastUpdated: ISODateString;
}

// ----- Webhook / Alerts -----

export type AlertEventType =
  | "oob_kill"
  | "gc_sweep"
  | "policy_violation"
  | "low_balance"
  | "agent_spawned"
  | "high_value_approval"
  | "agent_revoked"
  | "approval_required";

export interface WebhookConfig {
  id: string;
  url: string;
  secret: string;
  events: AlertEventType[];
  enabled: boolean;
  createdAt: ISODateString;
}

export interface AlertDelivery {
  eventType: AlertEventType;
  webhookId: string;
  status: "delivered" | "failed" | "pending";
  statusCode?: number;
  attemptedAt: ISODateString;
  error?: string;
}

// ----- Approval Queue -----

export interface ApprovalQueueItem {
  id: string;
  agentId: string;
  agentName: string;
  walletId: string;
  walletName: string;
  requestedAmountCents: number;
  payeeUrl: string;
  description: string;
  status: "pending_approval" | "approved" | "rejected";
  createdAt: ISODateString;
  resolvedAt: ISODateString | null;
  resolvedBy: string | null;
}

export interface ApprovalQueueStats {
  pendingCount: number;
  approvedToday: number;
  rejectedToday: number;
  totalValue: number;
}

// ----- Agent Wallet Access -----

export type AgentAccessRequestStatus = "pending" | "approved" | "denied";

export interface AgentAccessLimits {
  per_tx_limit_cents: number;
  hourly_limit_cents: number;
  daily_limit_cents: number;
  allowed_domains: string[];
  blocked_domains: string[];
}

export interface AgentAccessRequest {
  id: string;
  agentId: string;
  agentName: string;
  walletId: string;
  walletName: string;
  walletBalanceCents: number;
  requester: string;
  reason: string;
  status: AgentAccessRequestStatus;
  requestedLimits: AgentAccessLimits;
  approvedLimits: AgentAccessLimits | null;
  createdAt: ISODateString;
  resolvedAt: ISODateString | null;
  resolvedBy: string | null;
}

export interface ApproveAgentAccessInput {
  limits: AgentAccessLimits;
  note?: string;
}

// ----- Policy Plugins -----

export interface PolicyPluginInfo {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  config: Record<string, unknown>;
}

// ----- Multi-Currency -----

export type SupportedCurrency = "EUR" | "USD" | "GBP" | "USDC";

export interface CurrencyConfig {
  code: SupportedCurrency;
  name: string;
  symbol: string;
  decimals: number;
  minTransactionCents: number;
  supported: boolean;
}

export interface ExchangeRate {
  from: SupportedCurrency;
  to: SupportedCurrency;
  rate: number;
  updatedAt: ISODateString;
}

export interface ConversionResult {
  fromCurrency: SupportedCurrency;
  toCurrency: SupportedCurrency;
  fromAmountCents: number;
  toAmountCents: number;
  rate: number;
  rateTimestamp: ISODateString;
}

// ----- Devin Integration -----

export type DevinSessionStatus =
  | "provisioning"
  | "running"
  | "paused"
  | "completed"
  | "failed";

export interface DevinSession {
  id: string;
  devin_session_id: string | null;
  devin_session_url: string | null;
  agent_id: string;
  agent_name: string;
  wallet_id: string;
  wallet_name: string;
  task: string;
  status: DevinSessionStatus;
  total_spent_cents: number;
  transactions_approved: number;
  transactions_rejected: number;
  last_rejection_reason: string | null;
  per_tx_limit_cents: number;
  hourly_limit_cents: number;
  daily_limit_cents: number;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export interface LaunchDevinInput {
  wallet_id: string;
  task: string;
  agent_name?: string;
  per_tx_limit_cents: number;
  hourly_limit_cents: number;
  daily_limit_cents: number;
  allowed_domains?: string[];
}

export interface DevinSessionStats {
  total_sessions: number;
  active_sessions: number;
  total_spent_cents: number;
  total_transactions: number;
  total_rejections: number;
}

export interface EscalationRequest {
  session_id: string;
  reason: string;
  requested_amount_cents: number;
  current_limit_field: string;
  current_limit_cents: number;
}
