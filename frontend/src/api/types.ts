import type {
  AgentIdentity,
  AgentWallet,
  AuthResponse,
  CreateDepositInput,
  CreateDepositResponse,
  GcEvent,
  GcStatus,
  LedgerEntry,
  MolliePayment,
  OobKillEvent,
  OobSimulateResult,
  OobStatus,
  PolicyRules,
  RegisterAgentInput,
  RegisterAgentResponse,
  SpawnAgentInput,
  SpawnAgentResponse,
  SpendPoint,
  SpendPolicy,
  SweepResult,
  TransactionRequest,
  User,
  WalletAnalytics,
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
}
