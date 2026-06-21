import type {
  CreateWalletInput,
  FluxApi,
  LoginInput,
  RegisterInput,
  TransactionFilters,
} from "@/api/types";
import type {
  AgentAnalytics,
  AgentIdentity,
  AgentStatus,
  AgentWallet,
  AuthResponse,
  CreateDepositInput,
  CreateDepositResponse,
  LedgerEntry,
  MolliePayment,
  PaymentMethod,
  PolicyCheck,
  PolicyRules,
  RegisterAgentInput,
  RegisterAgentResponse,
  SpawnAgentInput,
  SpawnAgentResponse,
  SpendPoint,
  SpendPolicy,
  TransactionRequest,
  User,
  WalletAnalytics,
} from "@/types";

const SESSION_KEY = "flux.session";

export class HttpApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "HttpApiError";
    this.status = status;
    this.body = body;
  }
}

/* ------------------------------------------------------------------ *
 * Wire shapes — exactly what the Express backend returns. Drizzle's
 * `db.select()` yields the table's JS property names (camelCase), while
 * a few endpoints return hand-built snake_case action payloads. The
 * mappers below translate both into the frontend domain types so the UI
 * (and the in-memory mock) share one contract.
 * ------------------------------------------------------------------ */

interface WireUser {
  id: string;
  email: string;
  fullName: string;
  mollieCustomerId: string | null;
  createdAt: string;
}

interface WireWallet {
  id: string;
  ownerId: string;
  name: string;
  balanceCents: number;
  currency: string;
  status: AgentWallet["status"];
  createdAt: string;
  updatedAt: string;
}

interface WireAgent {
  id: string;
  walletId: string;
  ownerId: string;
  parentId: string | null;
  name: string;
  status: AgentStatus;
  hourlyLimitCents: number;
  perTxLimitCents: number;
  dailyLimitCents: number;
  allowedDomains: string[] | null;
  createdAt: string;
  lastSeenAt: string | null;
}

interface WirePolicy {
  id: string;
  agentId: string;
  version: number;
  rules: PolicyRules;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

interface WireLedgerEntry {
  id: string;
  walletId: string;
  agentId: string | null;
  type: LedgerEntry["type"];
  amountCents: number;
  balanceAfterCents: number;
  description: string;
  payeeUrl: string | null;
  molliePaymentId: string | null;
  paymentToken: string | null;
  status: LedgerEntry["status"];
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface WireTransaction {
  id: string;
  agentId: string;
  walletId: string;
  requestedAmountCents: number;
  payeeUrl: string;
  description: string;
  decision: TransactionRequest["decision"];
  rejectionReason: string | null;
  paymentToken: string | null;
  tokenExpiresAt: string | null;
  ledgerEntryId: string | null;
  createdAt: string;
}

interface WirePayment {
  id: string;
  userId: string;
  walletId: string;
  molliePaymentId: string;
  amountCents: number;
  currency: string;
  method: string | null;
  status: MolliePayment["status"];
  checkoutUrl: string;
  webhookReceivedAt: string | null;
  createdAt: string;
}

interface WireAuth {
  user_id: string;
  email: string;
  full_name: string;
  token: string;
  expires_in: number;
}

interface WireWalletAnalytics {
  wallet_id: string;
  balance_cents: number;
  total_deposited_cents: number;
  total_spent_cents: number;
  agents: Array<{
    agent_id: string;
    name: string;
    spent_last_hour_cents: number;
    spent_today_cents: number;
    transaction_count: number;
    last_tx_at: string | null;
  }>;
  recent_transactions: WireLedgerEntry[];
}

interface WireSpendPoint {
  date: string;
  amount_cents: number;
}

/* ------------------------------ mappers ------------------------------ */

function mapUser(w: WireUser): User {
  return {
    id: w.id,
    email: w.email,
    full_name: w.fullName,
    mollie_customer_id: w.mollieCustomerId ?? null,
    created_at: w.createdAt,
  };
}

function mapWallet(w: WireWallet): AgentWallet {
  return {
    id: w.id,
    owner_id: w.ownerId,
    name: w.name,
    balance_cents: w.balanceCents,
    currency: w.currency,
    status: w.status,
    created_at: w.createdAt,
    updated_at: w.updatedAt,
  };
}

function mapAgent(w: WireAgent, keyPreview = ""): AgentIdentity {
  return {
    id: w.id,
    wallet_id: w.walletId,
    owner_id: w.ownerId,
    parent_id: w.parentId ?? null,
    name: w.name,
    api_key_preview: keyPreview,
    status: w.status,
    hourly_limit_cents: w.hourlyLimitCents,
    per_tx_limit_cents: w.perTxLimitCents,
    daily_limit_cents: w.dailyLimitCents,
    allowed_domains: w.allowedDomains ?? [],
    blocked_domains: [],
    created_at: w.createdAt,
    last_seen_at: w.lastSeenAt ?? null,
  };
}

/**
 * The active policy is the backend's source of truth for an agent's effective
 * limits (the agent columns only hold the registration defaults). Overlay the
 * active policy rules so the agent-detail meters reflect the live policy.
 */
function applyActivePolicy(agent: AgentIdentity, policy: SpendPolicy | null): AgentIdentity {
  if (!policy) return agent;
  const r = policy.rules;
  return {
    ...agent,
    per_tx_limit_cents: r.per_tx_limit_cents ?? agent.per_tx_limit_cents,
    hourly_limit_cents: r.hourly_limit_cents ?? agent.hourly_limit_cents,
    daily_limit_cents: r.daily_limit_cents ?? agent.daily_limit_cents,
    allowed_domains: r.allowed_domains ?? agent.allowed_domains,
    blocked_domains: r.blocked_domains ?? agent.blocked_domains,
  };
}

function mapPolicy(w: WirePolicy): SpendPolicy {
  return {
    id: w.id,
    agent_id: w.agentId,
    version: w.version,
    rules: w.rules,
    is_active: w.isActive,
    created_by: w.createdBy,
    created_at: w.createdAt,
  };
}

function mapLedger(w: WireLedgerEntry, agentName: string | null): LedgerEntry {
  const metadata = w.metadata ?? undefined;
  const category =
    metadata && typeof metadata.category === "string" ? metadata.category : null;
  return {
    id: w.id,
    wallet_id: w.walletId,
    agent_id: w.agentId ?? null,
    agent_name: agentName,
    type: w.type,
    amount_cents: w.amountCents,
    balance_after_cents: w.balanceAfterCents,
    description: w.description,
    payee_url: w.payeeUrl ?? null,
    mollie_payment_id: w.molliePaymentId ?? null,
    payment_token: w.paymentToken ?? null,
    status: w.status,
    category,
    metadata,
    created_at: w.createdAt,
  };
}

function mapPayment(w: WirePayment): MolliePayment {
  return {
    id: w.id,
    user_id: w.userId,
    wallet_id: w.walletId,
    mollie_payment_id: w.molliePaymentId,
    amount_cents: w.amountCents,
    currency: w.currency,
    method: (w.method ?? "ideal") as PaymentMethod,
    status: w.status,
    checkout_url: w.checkoutUrl,
    webhook_received_at: w.webhookReceivedAt ?? null,
    created_at: w.createdAt,
  };
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * The backend stores a decision + rejection reason but not the per-check
 * breakdown. Reconstruct it from the agent's effective limits so the audit
 * detail view stays meaningful in live mode. (Historical rolling-window spend
 * isn't persisted, so the hourly/daily rows show the limit only.)
 */
function buildPolicyChecks(
  agent: AgentIdentity,
  amountCents: number,
  payeeUrl: string,
  decision: TransactionRequest["decision"],
  rejectionReason: string | null,
): PolicyCheck[] {
  const c = (cents: number) => `€${(cents / 100).toFixed(2)}`;
  const host = hostOf(payeeUrl);
  const reasonToRule: Record<string, string> = {
    per_tx_limit_exceeded: "per_tx_limit",
    hourly_limit_exceeded: "hourly_spent",
    daily_limit_exceeded: "daily_spent",
    insufficient_balance: "balance",
    domain_blocked: "domain",
  };
  const failedRule = decision === "rejected" && rejectionReason
    ? reasonToRule[rejectionReason]
    : undefined;
  const pass = (rule: string) => failedRule !== rule;
  return [
    {
      rule: "per_tx_limit",
      label: `per_tx_limit: ${c(amountCents)} ≤ ${c(agent.per_tx_limit_cents)}`,
      passed: pass("per_tx_limit"),
    },
    {
      rule: "hourly_spent",
      label: `hourly_limit: ${c(agent.hourly_limit_cents)}`,
      passed: pass("hourly_spent"),
    },
    {
      rule: "daily_spent",
      label: `daily_limit: ${c(agent.daily_limit_cents)}`,
      passed: pass("daily_spent"),
    },
    {
      rule: "balance",
      label: `balance ≥ ${c(amountCents)}`,
      passed: pass("balance"),
    },
    {
      rule: "domain",
      label: host ? `domain: ${host}` : "domain",
      passed: pass("domain"),
    },
  ];
}

/**
 * Thin REST client for the FLUX backend (see backend-architecture.md). Enabled
 * by setting VITE_USE_MOCK=false and VITE_API_BASE_URL to a live deployment.
 */
export function createHttpApi(baseUrl: string): FluxApi {
  const base = baseUrl.replace(/\/$/, "");

  async function req<T>(path: string, init?: RequestInit): Promise<T> {
    const token = localStorage.getItem(SESSION_KEY);
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const message =
        (body && typeof body === "object" && "error" in body
          ? String((body as { error: unknown }).error)
          : res.statusText) || "request_failed";
      throw new HttpApiError(res.status, message, body);
    }
    return body as T;
  }

  const qs = (params: Record<string, string | undefined>) => {
    const entries = Object.entries(params).filter(([, v]) => v != null && v !== "");
    if (!entries.length) return "";
    return "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join("&");
  };

  /** Fetch every agent once and index by id for name/limit enrichment. */
  async function agentIndex(): Promise<Map<string, AgentIdentity>> {
    const agents = await req<WireAgent[]>("/api/agents");
    return new Map(agents.map((a) => [a.id, mapAgent(a)]));
  }

  async function getAgentWithPolicy(id: string): Promise<AgentIdentity> {
    const [wire, policy] = await Promise.all([
      req<WireAgent>(`/api/agents/${id}`),
      req<WirePolicy | null>(`/api/agents/${id}/policies/active`).catch(() => null),
    ]);
    return applyActivePolicy(mapAgent(wire), policy ? mapPolicy(policy) : null);
  }

  return {
    async login(input: LoginInput): Promise<AuthResponse> {
      const res = await req<WireAuth>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      });
      localStorage.setItem(SESSION_KEY, res.token);
      const user = (await this.currentUser()) ?? {
        id: res.user_id,
        email: res.email,
        full_name: res.full_name,
        mollie_customer_id: null,
        created_at: new Date().toISOString(),
      };
      return { user, session_token: res.token };
    },
    async register(input: RegisterInput): Promise<AuthResponse> {
      const res = await req<WireAuth>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
      localStorage.setItem(SESSION_KEY, res.token);
      const user = (await this.currentUser()) ?? {
        id: res.user_id,
        email: res.email,
        full_name: res.full_name,
        mollie_customer_id: null,
        created_at: new Date().toISOString(),
      };
      return { user, session_token: res.token };
    },
    async currentUser(): Promise<User | null> {
      if (!localStorage.getItem(SESSION_KEY)) return null;
      try {
        return mapUser(await req<WireUser>("/api/auth/me"));
      } catch {
        return null;
      }
    },
    async logout(): Promise<void> {
      // The backend issues stateless JWTs; logging out is purely client-side.
      localStorage.removeItem(SESSION_KEY);
    },
    async updateProfile(input): Promise<User> {
      // The backend exposes no profile-update endpoint yet; merge locally so the
      // settings screen stays functional against the current API.
      const current = await this.currentUser();
      return {
        id: current?.id ?? "",
        email: input.email,
        full_name: input.full_name,
        mollie_customer_id: current?.mollie_customer_id ?? null,
        created_at: current?.created_at ?? new Date().toISOString(),
      };
    },

    async listWallets(): Promise<AgentWallet[]> {
      const res = await req<{ wallets: WireWallet[] }>("/api/wallets");
      return res.wallets.map(mapWallet);
    },
    async getWallet(id): Promise<AgentWallet> {
      return mapWallet(await req<WireWallet>(`/api/wallets/${id}`));
    },
    async createWallet(input: CreateWalletInput): Promise<AgentWallet> {
      return mapWallet(
        await req<WireWallet>("/api/wallets", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      );
    },
    async setWalletStatus(id, status): Promise<AgentWallet> {
      return mapWallet(
        await req<WireWallet>(`/api/wallets/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }),
      );
    },
    async getWalletAnalytics(id): Promise<WalletAnalytics> {
      const [res, agents] = await Promise.all([
        req<WireWalletAnalytics>(`/api/wallets/${id}/analytics`),
        agentIndex(),
      ]);
      const agentStats: AgentAnalytics[] = res.agents.map((a) => {
        const full = agents.get(a.agent_id);
        return {
          agent_id: a.agent_id,
          name: a.name,
          status: full?.status ?? "active",
          spent_last_hour_cents: a.spent_last_hour_cents,
          spent_today_cents: a.spent_today_cents,
          hourly_limit_cents: full?.hourly_limit_cents ?? 0,
          daily_limit_cents: full?.daily_limit_cents ?? 0,
          per_tx_limit_cents: full?.per_tx_limit_cents ?? 0,
          transaction_count: a.transaction_count,
          last_tx_at: a.last_tx_at,
          last_seen_at: full?.last_seen_at ?? null,
        };
      });
      return {
        wallet_id: res.wallet_id,
        balance_cents: res.balance_cents,
        total_deposited_cents: res.total_deposited_cents,
        total_spent_cents: res.total_spent_cents,
        agents: agentStats,
        recent_transactions: res.recent_transactions.map((e) =>
          mapLedger(e, e.agentId ? agents.get(e.agentId)?.name ?? null : null),
        ),
      };
    },
    async getWalletSpendSeries(id): Promise<SpendPoint[]> {
      const rows = await req<WireSpendPoint[]>(`/api/wallets/${id}/spend-series`);
      return rows.map(mapSpendPoint);
    },

    async listLedger(walletId): Promise<LedgerEntry[]> {
      const [entries, agents] = await Promise.all([
        req<WireLedgerEntry[]>(`/api/wallets/${walletId}/ledger`),
        agentIndex(),
      ]);
      return entries.map((e) =>
        mapLedger(e, e.agentId ? agents.get(e.agentId)?.name ?? null : null),
      );
    },
    async listTransactions(filters?: TransactionFilters): Promise<TransactionRequest[]> {
      // Only approved/rejected are server-side filters; "all"/"deposit" and free
      // text search are handled client-side by the pages.
      const type =
        filters?.type === "approved" || filters?.type === "rejected"
          ? filters.type
          : undefined;
      const [txns, agents, wallets] = await Promise.all([
        req<WireTransaction[]>(
          "/api/transactions" +
            qs({ wallet_id: filters?.walletId, agent_ids: filters?.agentIds?.join(","), type }),
        ),
        agentIndex(),
        this.listWallets(),
      ]);
      const walletNames = new Map(wallets.map((w) => [w.id, w.name]));
      return txns.map((t) =>
        mapTransaction(t, {
          agentName: agents.get(t.agentId)?.name ?? "",
          walletName: walletNames.get(t.walletId) ?? "",
        }),
      );
    },
    async getTransaction(id): Promise<TransactionRequest> {
      const txn = await req<WireTransaction>(`/api/transactions/${id}`);
      const [agent, wallet] = await Promise.all([
        getAgentWithPolicy(txn.agentId).catch(() => null),
        this.getWallet(txn.walletId).catch(() => null),
      ]);

      let balanceBefore = wallet?.balance_cents ?? 0;
      let balanceAfter: number | null = null;
      if (txn.decision === "approved" && txn.ledgerEntryId && wallet) {
        const ledger = await this.listLedger(txn.walletId).catch(() => []);
        const entry = ledger.find((e) => e.id === txn.ledgerEntryId);
        if (entry) {
          balanceAfter = entry.balance_after_cents;
          balanceBefore = entry.balance_after_cents + txn.requestedAmountCents;
        }
      }

      return mapTransaction(txn, {
        agentName: agent?.name ?? "",
        walletName: wallet?.name ?? "",
        policyChecks: agent
          ? buildPolicyChecks(agent, txn.requestedAmountCents, txn.payeeUrl, txn.decision, txn.rejectionReason)
          : [],
        balanceBeforeCents: balanceBefore,
        balanceAfterCents: balanceAfter,
      });
    },

    async listAgents(): Promise<AgentIdentity[]> {
      const agents = await req<WireAgent[]>("/api/agents");
      return agents.map((a) => mapAgent(a));
    },
    getAgent: (id) => getAgentWithPolicy(id),
    async registerAgent(input: RegisterAgentInput): Promise<RegisterAgentResponse> {
      const res = await req<{ agent_id: string; api_key: string; warning: string }>(
        "/api/agents/register",
        {
          method: "POST",
          body: JSON.stringify({
            wallet_id: input.wallet_id,
            parent_id: input.parent_id ?? null,
            name: input.name,
            hourly_limit_cents: input.hourly_limit_cents,
            per_tx_limit_cents: input.per_tx_limit_cents,
            daily_limit_cents: input.daily_limit_cents,
            allowed_domains: input.allowed_domains,
          }),
        },
      );
      const wire = await req<WireAgent>(`/api/agents/${res.agent_id}`);
      return {
        agent: mapAgent(wire, res.api_key.slice(-4)),
        api_key: res.api_key,
        warning: res.warning,
      };
    },
    async spawnAgent(_parentId: string, input: SpawnAgentInput): Promise<SpawnAgentResponse> {
      return req<SpawnAgentResponse>("/api/agents/spawn", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    async setAgentStatus(id, status): Promise<AgentIdentity> {
      return mapAgent(
        await req<WireAgent>(`/api/agents/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }),
      );
    },
    getAgentAnalytics: (id) =>
      req<{ spent_last_hour_cents: number; spent_today_cents: number }>(
        `/api/agents/${id}/analytics`,
      ),
    async getAgentSpendSeries(id): Promise<SpendPoint[]> {
      const rows = await req<WireSpendPoint[]>(`/api/agents/${id}/spend-series`);
      return rows.map(mapSpendPoint);
    },

    async listPolicies(agentId): Promise<SpendPolicy[]> {
      const policies = await req<WirePolicy[]>(`/api/agents/${agentId}/policies`);
      return policies.map(mapPolicy);
    },
    async getActivePolicy(agentId): Promise<SpendPolicy | null> {
      const policy = await req<WirePolicy | null>(`/api/agents/${agentId}/policies/active`);
      return policy ? mapPolicy(policy) : null;
    },
    async updatePolicy(agentId, rules: PolicyRules): Promise<SpendPolicy> {
      return mapPolicy(
        await req<WirePolicy>(`/api/agents/${agentId}/policy`, {
          method: "POST",
          body: JSON.stringify({ rules }),
        }),
      );
    },

    async createDeposit(input: CreateDepositInput): Promise<CreateDepositResponse> {
      return req<CreateDepositResponse>("/api/payments/deposit", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    async getPaymentStatus(molliePaymentId): Promise<MolliePayment> {
      return mapPayment(await req<WirePayment>(`/api/payments/${molliePaymentId}/status`));
    },
  };
}

function mapSpendPoint(p: WireSpendPoint): SpendPoint {
  const d = new Date(p.date);
  const label = Number.isNaN(d.getTime())
    ? p.date
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return {
    label,
    ts: Number.isNaN(d.getTime()) ? p.date : d.toISOString(),
    spent_cents: p.amount_cents,
  };
}

function mapTransaction(
  w: WireTransaction,
  ctx: {
    agentName: string;
    walletName: string;
    policyChecks?: PolicyCheck[];
    balanceBeforeCents?: number;
    balanceAfterCents?: number | null;
  },
): TransactionRequest {
  return {
    id: w.id,
    agent_id: w.agentId,
    agent_name: ctx.agentName,
    wallet_id: w.walletId,
    wallet_name: ctx.walletName,
    requested_amount_cents: w.requestedAmountCents,
    payee_url: w.payeeUrl,
    description: w.description,
    category: null,
    decision: w.decision,
    rejection_reason: w.rejectionReason ?? null,
    payment_token: w.paymentToken ?? null,
    token_expires_at: w.tokenExpiresAt ?? null,
    token_used_at: w.decision === "approved" && w.paymentToken === null ? w.createdAt : null,
    ledger_entry_id: w.ledgerEntryId ?? null,
    balance_before_cents: ctx.balanceBeforeCents ?? 0,
    balance_after_cents: ctx.balanceAfterCents ?? null,
    policy_checks: ctx.policyChecks ?? [],
    created_at: w.createdAt,
  };
}
