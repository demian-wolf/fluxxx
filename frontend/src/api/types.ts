import type {
  AgentIdentity,
  AgentWallet,
  AlertDelivery,
  AlertEventType,
  ApprovalQueueItem,
  ApprovalQueueStats,
  AuthResponse,
  BillingAccount,
  ConversionResult,
  CreateDepositInput,
  CreateDepositResponse,
  CurrencyConfig,
  DepletionForecast,
  ExchangeRate,
  FeeEvent,
  GcEvent,
  GcStatus,
  LedgerEntry,
  LicensingStats,
  MarketplaceProvider,
  MolliePayment,
  OobKillEvent,
  OobSimulateResult,
  OobStatus,
  PolicyPluginInfo,
  PolicyRules,
  ProviderStats,
  RegisterAgentInput,
  RegisterAgentResponse,
  ReputationScore,
  SaasPlan,
  SaasTier,
  SpawnAgentInput,
  SpawnAgentResponse,
  SpendPoint,
  SpendPolicy,
  SupportedCurrency,
  SweepResult,
  TransactionRequest,
  User,
  WalletAnalytics,
  WebhookConfig,
  WhiteLabelLicense,
} from "@/types";

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  full_name: string;
  email: string;
  password: string;
}

export interface CreateWalletInput {
  name: string;
}

export interface TransactionFilters {
  agentIds?: string[];
  type?: "all" | "approved" | "rejected" | "deposit";
  walletId?: string;
  search?: string;
}

/**
 * The full surface the FLUX frontend depends on. Both the in-memory mock and the
 * real HTTP client implement this so screens never care which backend is live.
 */
export interface FluxApi {
  // auth
  login(input: LoginInput): Promise<AuthResponse>;
  register(input: RegisterInput): Promise<AuthResponse>;
  currentUser(): Promise<User | null>;
  logout(): Promise<void>;
  updateProfile(input: { full_name: string; email: string }): Promise<User>;

  // wallets
  listWallets(): Promise<AgentWallet[]>;
  getWallet(id: string): Promise<AgentWallet>;
  createWallet(input: CreateWalletInput): Promise<AgentWallet>;
  setWalletStatus(id: string, status: AgentWallet["status"]): Promise<AgentWallet>;
  getWalletAnalytics(id: string): Promise<WalletAnalytics>;
  getWalletSpendSeries(id: string): Promise<SpendPoint[]>;

  // ledger / transactions
  listLedger(walletId: string): Promise<LedgerEntry[]>;
  listTransactions(filters?: TransactionFilters): Promise<TransactionRequest[]>;
  getTransaction(id: string): Promise<TransactionRequest>;

  // agents
  listAgents(): Promise<AgentIdentity[]>;
  getAgent(id: string): Promise<AgentIdentity>;
  registerAgent(input: RegisterAgentInput): Promise<RegisterAgentResponse>;
  spawnAgent(parentId: string, input: SpawnAgentInput): Promise<SpawnAgentResponse>;
  setAgentStatus(id: string, status: AgentIdentity["status"]): Promise<AgentIdentity>;
  getAgentAnalytics(id: string): Promise<{
    spent_last_hour_cents: number;
    spent_today_cents: number;
  }>;
  getAgentSpendSeries(id: string): Promise<SpendPoint[]>;

  // policies
  listPolicies(agentId: string): Promise<SpendPolicy[]>;
  getActivePolicy(agentId: string): Promise<SpendPolicy | null>;
  updatePolicy(agentId: string, rules: PolicyRules): Promise<SpendPolicy>;

  // payments (Mollie)
  createDeposit(input: CreateDepositInput): Promise<CreateDepositResponse>;
  getPaymentStatus(molliePaymentId: string): Promise<MolliePayment>;

  // capital reclamation (Agentic GC)
  getGcStatus(): Promise<GcStatus>;
  listGcEvents(): Promise<GcEvent[]>;
  triggerSweep(ttlMs?: number): Promise<SweepResult>;

  // Out-of-Budget (OOB) Killer
  getOobStatus(): Promise<OobStatus>;
  listOobEvents(): Promise<OobKillEvent[]>;
  simulateOobKill(walletId: string, thresholdCents?: number): Promise<OobSimulateResult>;

  // Budget Forecasting
  getForecast(walletId: string, windowHours?: number): Promise<DepletionForecast>;

  // Agent Reputation
  getReputation(agentId: string): Promise<ReputationScore>;
  getAllReputations(): Promise<ReputationScore[]>;

  // Webhook / Alerts
  listWebhooks(): Promise<WebhookConfig[]>;
  createWebhook(url: string, events: AlertEventType[], secret?: string): Promise<WebhookConfig>;
  deleteWebhook(id: string): Promise<void>;
  getDeliveryLog(limit?: number): Promise<AlertDelivery[]>;

  // Approval Queue
  getApprovalStats(): Promise<ApprovalQueueStats>;
  listPendingApprovals(): Promise<ApprovalQueueItem[]>;
  approveTransaction(transactionId: string): Promise<{ paymentToken: string; balanceAfterCents: number }>;
  rejectTransaction(transactionId: string, reason?: string): Promise<void>;

  // Policy Plugins
  listPlugins(): Promise<PolicyPluginInfo[]>;
  togglePlugin(pluginId: string, enabled: boolean): Promise<PolicyPluginInfo>;
  updatePluginConfig(pluginId: string, config: Record<string, unknown>): Promise<PolicyPluginInfo>;

  // Multi-Currency
  listCurrencies(): Promise<CurrencyConfig[]>;
  getExchangeRates(): Promise<ExchangeRate[]>;
  convertCurrency(amountCents: number, from: SupportedCurrency, to: SupportedCurrency): Promise<ConversionResult>;

  // billing & monetization
  listPlans(): Promise<SaasPlan[]>;
  getBillingAccount(): Promise<BillingAccount>;
  changePlan(tier: SaasTier): Promise<BillingAccount>;
  listFeeEvents(): Promise<FeeEvent[]>;

  // provider marketplace
  getProviderStats(): Promise<ProviderStats>;
  listProviders(): Promise<MarketplaceProvider[]>;
  verifyProvider(id: string): Promise<MarketplaceProvider>;

  // white-label licensing
  getLicensingStats(): Promise<LicensingStats>;
  listLicenses(): Promise<WhiteLabelLicense[]>;
}
