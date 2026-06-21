import type {
  FluxApi,
  CreateWalletInput,
  LoginInput,
  RegisterInput,
  TransactionFilters,
} from "@/api/types";
import type {
  AgentAnalytics,
  AgentIdentity,
  AgentWallet,
  AuthResponse,
  BillingAccount,
  CreateDepositInput,
  CreateDepositResponse,
  FeeEvent,
  GcEvent,
  GcReason,
  GcStatus,
  LedgerEntry,
  LicensingStats,
  MarketplaceProvider,
  MolliePayment,
  OobKillEvent,
  OobSimulateResult,
  OobStatus,
  PolicyCheck,
  PolicyRules,
  ProviderStats,
  RegisterAgentInput,
  RegisterAgentResponse,
  SaasPlan,
  SaasTier,
  SpawnAgentInput,
  SpawnAgentResponse,
  SpendPoint,
  SpendPolicy,
  SweepResult,
  TransactionRequest,
  User,
  WalletAnalytics,
  WhiteLabelLicense,
} from "@/types";
import { sleep } from "@/lib/utils";
import {
  createInitialState,
  genApiKey,
  genId,
  genToken,
  MockState,
  PLANS,
  SEED_PAYEES,
} from "./store";

const SESSION_KEY = "flux.session";
const USER_KEY = "flux.user";

const state: MockState = createInitialState();

// ---- live simulation -------------------------------------------------------

let simStarted = false;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export function subscribeToLedger(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function spentInWindow(agentId: string, sinceMs: number): number {
  const cutoff = Date.now() - sinceMs;
  return state.ledger
    .filter(
      (e) =>
        e.agent_id === agentId &&
        e.type === "spend" &&
        new Date(e.created_at).getTime() >= cutoff,
    )
    .reduce((sum, e) => sum + e.amount_cents, 0);
}

function buildChecks(
  agent: AgentIdentity,
  amount: number,
  domain: string,
  balanceBefore: number,
): { checks: PolicyCheck[]; passed: boolean; reason: string | null } {
  const hourly = spentInWindow(agent.id, 3_600_000);
  const daily = spentInWindow(agent.id, 86_400_000);
  const c = (cents: number) => `€${(cents / 100).toFixed(2)}`;
  const blocked = agent.blocked_domains.includes(domain);
  const allowed =
    agent.allowed_domains.length === 0 || agent.allowed_domains.includes(domain);
  const checks: PolicyCheck[] = [
    {
      rule: "per_tx_limit",
      label: `per_tx_limit: ${c(amount)} ≤ ${c(agent.per_tx_limit_cents)}`,
      passed: amount <= agent.per_tx_limit_cents,
    },
    {
      rule: "hourly_spent",
      label: `hourly_spent: ${c(hourly + amount)} ≤ ${c(agent.hourly_limit_cents)}`,
      passed: hourly + amount <= agent.hourly_limit_cents,
    },
    {
      rule: "daily_spent",
      label: `daily_spent: ${c(daily + amount)} ≤ ${c(agent.daily_limit_cents)}`,
      passed: daily + amount <= agent.daily_limit_cents,
    },
    {
      rule: "balance",
      label: `balance_before: ${c(balanceBefore)} ≥ ${c(amount)}`,
      passed: balanceBefore >= amount,
    },
    {
      rule: "domain",
      label: blocked
        ? `domain blocked: ${domain} ✗`
        : `domain allowed: ${domain} ${allowed ? "✓" : "✗"}`,
      passed: !blocked && allowed,
    },
  ];
  const failed = checks.find((x) => !x.passed);
  const reasonMap: Record<string, string> = {
    per_tx_limit: "per_tx_limit_exceeded",
    hourly_spent: "hourly_limit_exceeded",
    daily_spent: "daily_limit_exceeded",
    balance: "insufficient_balance",
    domain: "domain_blocked",
  };
  return {
    checks,
    passed: !failed,
    reason: failed ? reasonMap[failed.rule] : null,
  };
}

function simulateTick() {
  const candidates = state.agents.filter((a) => a.status === "active");
  if (candidates.length === 0) return;
  const agent = candidates[Math.floor(Math.random() * candidates.length)];
  const wallet = state.wallets.find((w) => w.id === agent.wallet_id);
  if (!wallet || wallet.status !== "active") return;

  const seed = SEED_PAYEES[Math.floor(Math.random() * SEED_PAYEES.length)];
  const n = Math.floor(Math.random() * 900) + 1;
  const payee = `${seed.url}${n}`;
  const domain = new URL(payee).hostname;
  // most txns are small and within limits; occasionally over the per-tx cap
  const over = Math.random() < 0.15;
  const amount = over
    ? agent.per_tx_limit_cents + Math.floor(Math.random() * 6) + 1
    : Math.max(1, Math.floor(Math.random() * agent.per_tx_limit_cents) + 1);

  const balanceBefore = wallet.balance_cents;
  const { checks, passed, reason } = buildChecks(
    agent,
    amount,
    domain,
    balanceBefore,
  );
  const ts = new Date().toISOString();
  agent.last_seen_at = ts;

  if (passed) {
    const token = genToken();
    wallet.balance_cents = balanceBefore - amount;
    wallet.updated_at = ts;
    if (wallet.balance_cents <= 0) wallet.status = "depleted";
    const ledgerId = genId("led");
    state.ledger.push({
      id: ledgerId,
      wallet_id: wallet.id,
      agent_id: agent.id,
      agent_name: agent.name,
      type: "spend",
      amount_cents: amount,
      balance_after_cents: wallet.balance_cents,
      description: `${seed.desc}${n}`,
      payee_url: payee,
      mollie_payment_id: null,
      payment_token: token,
      status: "settled",
      category: seed.category,
      created_at: ts,
    });
    state.transactions.push({
      id: genId("tx"),
      agent_id: agent.id,
      agent_name: agent.name,
      wallet_id: wallet.id,
      wallet_name: wallet.name,
      requested_amount_cents: amount,
      payee_url: payee,
      description: `${seed.desc}${n}`,
      category: seed.category,
      decision: "approved",
      rejection_reason: null,
      payment_token: token,
      token_expires_at: new Date(Date.now() + 30_000).toISOString(),
      token_used_at: new Date(Date.now() + 300).toISOString(),
      ledger_entry_id: ledgerId,
      balance_before_cents: balanceBefore,
      balance_after_cents: wallet.balance_cents,
      policy_checks: checks,
      created_at: ts,
    });
    // OOB Killer check: if balance drops to threshold, kill non-essential children
    runOobCheck(wallet.id);
  } else {
    state.transactions.push({
      id: genId("tx"),
      agent_id: agent.id,
      agent_name: agent.name,
      wallet_id: wallet.id,
      wallet_name: wallet.name,
      requested_amount_cents: amount,
      payee_url: payee,
      description: `${seed.desc}${n}`,
      category: seed.category,
      decision: "rejected",
      rejection_reason: reason,
      payment_token: null,
      token_expires_at: null,
      token_used_at: null,
      ledger_entry_id: null,
      balance_before_cents: balanceBefore,
      balance_after_cents: null,
      policy_checks: checks,
      created_at: ts,
    });
  }
  emit();
}

// ---- GC simulation --------------------------------------------------------

const GC_TTL_MS = 10 * 60 * 1000; // 10 minutes for demo mode

function detectMockZombies(): Array<{ agent: AgentIdentity; reason: GcReason }> {
  const cutoff = Date.now() - GC_TTL_MS;
  const zombies: Array<{ agent: AgentIdentity; reason: GcReason }> = [];
  const alreadyReclaimed = new Set(state.gcEvents.map((e) => e.agent_id));

  for (const agent of state.agents) {
    if (alreadyReclaimed.has(agent.id)) continue;
    if (!agent.parent_id) continue; // root agents are not GC'd

    if (agent.status === "revoked") {
      zombies.push({ agent, reason: "agent_revoked" });
    } else if (agent.status === "suspended") {
      zombies.push({ agent, reason: "agent_suspended" });
    } else if (
      agent.status === "active" &&
      agent.last_seen_at &&
      new Date(agent.last_seen_at).getTime() < cutoff
    ) {
      zombies.push({ agent, reason: "ttl_expired" });
    } else if (
      agent.status === "active" &&
      !agent.last_seen_at
    ) {
      zombies.push({ agent, reason: "ttl_expired" });
    }
  }
  return zombies;
}

function reclaimAgent(agent: AgentIdentity, reason: GcReason): GcEvent | null {
  const alreadyReclaimed = state.gcEvents.some((e) => e.agent_id === agent.id);
  if (alreadyReclaimed) return null;

  // Revoke the agent
  if (agent.status !== "revoked") {
    agent.status = "revoked";
  }

  // Cascade: revoke children
  const queue = [agent.id];
  const seen = new Set(queue);
  while (queue.length) {
    const current = queue.shift() as string;
    for (const child of state.agents) {
      if (child.parent_id === current && !seen.has(child.id)) {
        seen.add(child.id);
        child.status = "revoked";
        queue.push(child.id);
      }
    }
  }

  const wallet = state.wallets.find((w) => w.id === agent.wallet_id);
  const dailyLimitFreed = agent.daily_limit_cents;

  // Check for unreleased holds
  const pendingHolds = state.ledger.filter(
    (e) => e.agent_id === agent.id && e.type === "hold" && e.status === "pending",
  );
  const reclaimedCents = pendingHolds.reduce((sum, e) => sum + e.amount_cents, 0);

  let refundLedgerEntryId: string | null = null;

  if (reclaimedCents > 0 && wallet) {
    // Create refund ledger entry
    const ledgerId = genId("led");
    wallet.balance_cents += reclaimedCents;
    wallet.updated_at = new Date().toISOString();
    if (wallet.status === "depleted" && wallet.balance_cents > 0) {
      wallet.status = "active";
    }
    state.ledger.push({
      id: ledgerId,
      wallet_id: wallet.id,
      agent_id: agent.id,
      agent_name: agent.name,
      type: "refund",
      amount_cents: reclaimedCents,
      balance_after_cents: wallet.balance_cents,
      description: `Capital reclamation: zombie agent "${agent.name}" (${reason})`,
      payee_url: null,
      mollie_payment_id: null,
      payment_token: null,
      status: "settled",
      category: null,
      metadata: { gc_reason: reason, reclaimed_from_agent: agent.id },
      created_at: new Date().toISOString(),
    });
    refundLedgerEntryId = ledgerId;

    // Mark holds as reversed
    for (const hold of pendingHolds) {
      hold.status = "reversed";
    }
  }

  const gcEvent: GcEvent = {
    id: genId("gc"),
    agent_id: agent.id,
    wallet_id: agent.wallet_id,
    reason,
    reclaimed_cents: reclaimedCents,
    daily_limit_freed: dailyLimitFreed,
    refund_ledger_entry_id: refundLedgerEntryId,
    agent_name: agent.name,
    parent_agent_id: agent.parent_id,
    created_at: new Date().toISOString(),
  };
  state.gcEvents.push(gcEvent);
  return gcEvent;
}

function runMockSweep(): SweepResult {
  const zombies = detectMockZombies();
  const events: GcEvent[] = [];
  let totalReclaimedCents = 0;
  let totalLimitFreed = 0;

  for (const { agent, reason } of zombies) {
    const event = reclaimAgent(agent, reason);
    if (event) {
      events.push(event);
      totalReclaimedCents += event.reclaimed_cents;
      totalLimitFreed += event.daily_limit_freed;
    }
  }

  if (events.length > 0) emit();

  return {
    zombies_found: zombies.length,
    events_created: events.length,
    total_reclaimed_cents: totalReclaimedCents,
    total_limit_freed: totalLimitFreed,
    events,
  };
}

function simulateGcTick() {
  runMockSweep();
}

// ---- OOB Killer simulation -------------------------------------------------

const OOB_THRESHOLD_CENTS = 500; // €5

function runOobCheck(walletId: string, thresholdCents: number = OOB_THRESHOLD_CENTS): OobSimulateResult {
  const wallet = state.wallets.find((w) => w.id === walletId);
  if (!wallet || wallet.balance_cents > thresholdCents) {
    return {
      triggered: false,
      wallet_id: walletId,
      balance_cents: wallet?.balance_cents ?? 0,
      threshold_cents: thresholdCents,
      agents_killed: 0,
      tokens_invalidated: 0,
      protected_agent_id: null,
      protected_agent_name: null,
      killed_agent_names: [],
      event: null,
    };
  }

  // Find root agents to protect
  const rootAgents = state.agents.filter(
    (a) => a.wallet_id === walletId && a.parent_id === null && a.status === "active",
  );
  const protectedAgent = rootAgents.length > 0 ? rootAgents[0] : null;

  // Find child agents to kill
  const childAgents = state.agents.filter(
    (a) => a.wallet_id === walletId && a.parent_id !== null && a.status === "active",
  );

  if (childAgents.length === 0) {
    return {
      triggered: false,
      wallet_id: walletId,
      balance_cents: wallet.balance_cents,
      threshold_cents: thresholdCents,
      agents_killed: 0,
      tokens_invalidated: 0,
      protected_agent_id: protectedAgent?.id ?? null,
      protected_agent_name: protectedAgent?.name ?? null,
      killed_agent_names: [],
      event: null,
    };
  }

  const killedIds = childAgents.map((a) => a.id);
  const killedNames = childAgents.map((a) => a.name);

  // Revoke child agents
  for (const agent of childAgents) {
    agent.status = "revoked";
  }

  // Invalidate pending transactions from killed agents
  let tokensInvalidated = 0;
  for (const tx of state.transactions) {
    if (
      killedIds.includes(tx.agent_id) &&
      tx.decision === "approved" &&
      tx.payment_token &&
      tx.token_expires_at &&
      new Date(tx.token_expires_at).getTime() > Date.now()
    ) {
      tx.payment_token = null;
      tokensInvalidated++;
    }
  }

  const event: OobKillEvent = {
    id: genId("oob"),
    wallet_id: walletId,
    trigger_balance_cents: wallet.balance_cents,
    threshold_cents: thresholdCents,
    agents_killed: killedIds.length,
    tokens_invalidated: tokensInvalidated,
    protected_agent_id: protectedAgent?.id ?? null,
    protected_agent_name: protectedAgent?.name ?? null,
    killed_agent_ids: killedIds,
    killed_agent_names: killedNames,
    created_at: new Date().toISOString(),
  };
  state.oobKillEvents.push(event);
  emit();

  return {
    triggered: true,
    wallet_id: walletId,
    balance_cents: wallet.balance_cents,
    threshold_cents: thresholdCents,
    agents_killed: killedIds.length,
    tokens_invalidated: tokensInvalidated,
    protected_agent_id: protectedAgent?.id ?? null,
    protected_agent_name: protectedAgent?.name ?? null,
    killed_agent_names: killedNames,
    event,
  };
}

function ensureSimulation() {
  if (simStarted || typeof window === "undefined") return;
  simStarted = true;
  const loop = () => {
    simulateTick();
    setTimeout(loop, 2200 + Math.random() * 2600);
  };
  setTimeout(loop, 2500);

  // Run GC sweep periodically (every 30s in demo mode)
  const gcLoop = () => {
    simulateGcTick();
    setTimeout(gcLoop, 30_000 + Math.random() * 10_000);
  };
  setTimeout(gcLoop, 15_000);
}

// ---- helpers ---------------------------------------------------------------

function requireWallet(id: string): AgentWallet {
  const w = state.wallets.find((x) => x.id === id);
  if (!w) throw new ApiError(404, "wallet_not_found");
  return w;
}

function requireAgent(id: string): AgentIdentity {
  const a = state.agents.find((x) => x.id === id);
  if (!a) throw new ApiError(404, "agent_not_found");
  return a;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

function agentAnalytics(agent: AgentIdentity): AgentAnalytics {
  const txns = state.transactions.filter(
    (t) => t.agent_id === agent.id && t.decision === "approved",
  );
  const last = txns.length ? txns[txns.length - 1].created_at : null;
  return {
    agent_id: agent.id,
    name: agent.name,
    status: agent.status,
    spent_last_hour_cents: spentInWindow(agent.id, 3_600_000),
    spent_today_cents: spentInWindow(agent.id, 86_400_000),
    hourly_limit_cents: agent.hourly_limit_cents,
    daily_limit_cents: agent.daily_limit_cents,
    per_tx_limit_cents: agent.per_tx_limit_cents,
    transaction_count: txns.length,
    last_tx_at: last,
    last_seen_at: agent.last_seen_at,
  };
}

function hourlySeries(filter: (e: LedgerEntry) => boolean): SpendPoint[] {
  const buckets: SpendPoint[] = [];
  const nowMs = Date.now();
  for (let i = 23; i >= 0; i--) {
    const start = nowMs - i * 3_600_000;
    const d = new Date(start);
    const label = `${d.getHours().toString().padStart(2, "0")}:00`;
    const spent = state.ledger
      .filter(filter)
      .filter((e) => e.type === "spend")
      .filter((e) => {
        const t = new Date(e.created_at).getTime();
        return t >= start - 3_600_000 && t < start;
      })
      .reduce((s, e) => s + e.amount_cents, 0);
    buckets.push({ label, ts: d.toISOString(), spent_cents: spent });
  }
  return buckets;
}

// ---- API implementation ----------------------------------------------------

export const mockApi: FluxApi = {
  async login({ email }: LoginInput): Promise<AuthResponse> {
    await sleep(420);
    if (!email) throw new ApiError(401, "invalid_credentials");
    const user: User = { ...state.user, email };
    state.user = user;
    state.sessionToken = genId("sess");
    localStorage.setItem(SESSION_KEY, state.sessionToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    ensureSimulation();
    return { user, session_token: state.sessionToken };
  },

  async register({ full_name, email }: RegisterInput): Promise<AuthResponse> {
    await sleep(520);
    const user: User = {
      ...state.user,
      full_name,
      email,
      created_at: new Date().toISOString(),
    };
    state.user = user;
    state.sessionToken = genId("sess");
    localStorage.setItem(SESSION_KEY, state.sessionToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    ensureSimulation();
    return { user, session_token: state.sessionToken };
  },

  async currentUser(): Promise<User | null> {
    const token = localStorage.getItem(SESSION_KEY);
    if (!token) return null;
    state.sessionToken = token;
    const stored = localStorage.getItem(USER_KEY);
    if (stored) state.user = JSON.parse(stored) as User;
    ensureSimulation();
    return state.user;
  },

  async logout(): Promise<void> {
    state.sessionToken = null;
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(USER_KEY);
  },

  async updateProfile({ full_name, email }): Promise<User> {
    await sleep(300);
    state.user = { ...state.user, full_name, email };
    localStorage.setItem(USER_KEY, JSON.stringify(state.user));
    return state.user;
  },

  async listWallets(): Promise<AgentWallet[]> {
    await sleep(220);
    return structuredClone(state.wallets);
  },

  async getWallet(id): Promise<AgentWallet> {
    await sleep(160);
    return structuredClone(requireWallet(id));
  },

  async createWallet({ name }: CreateWalletInput): Promise<AgentWallet> {
    await sleep(360);
    const wallet: AgentWallet = {
      id: genId("wallet"),
      owner_id: state.user.id,
      name,
      balance_cents: 0,
      currency: "EUR",
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    state.wallets.push(wallet);
    return structuredClone(wallet);
  },

  async setWalletStatus(id, status): Promise<AgentWallet> {
    await sleep(240);
    const w = requireWallet(id);
    w.status = status;
    w.updated_at = new Date().toISOString();
    return structuredClone(w);
  },

  async getWalletAnalytics(id): Promise<WalletAnalytics> {
    await sleep(200);
    const wallet = requireWallet(id);
    const deposits = state.ledger
      .filter((e) => e.wallet_id === id && e.type === "deposit")
      .reduce((s, e) => s + e.amount_cents, 0);
    const spent = state.ledger
      .filter((e) => e.wallet_id === id && e.type === "spend")
      .reduce((s, e) => s + e.amount_cents, 0);
    const agents = state.agents
      .filter((a) => a.wallet_id === id)
      .map(agentAnalytics);
    const recent = state.ledger
      .filter((e) => e.wallet_id === id)
      .slice(-12)
      .reverse();
    return {
      wallet_id: id,
      balance_cents: wallet.balance_cents,
      total_deposited_cents: deposits,
      total_spent_cents: spent,
      agents,
      recent_transactions: structuredClone(recent),
    };
  },

  async getWalletSpendSeries(id): Promise<SpendPoint[]> {
    await sleep(160);
    return hourlySeries((e) => e.wallet_id === id);
  },

  async listLedger(walletId): Promise<LedgerEntry[]> {
    await sleep(180);
    return structuredClone(
      state.ledger
        .filter((e) => e.wallet_id === walletId)
        .slice()
        .reverse(),
    );
  },

  async listTransactions(filters?: TransactionFilters): Promise<TransactionRequest[]> {
    await sleep(220);
    let rows = state.transactions.slice().reverse();
    if (filters?.walletId) rows = rows.filter((t) => t.wallet_id === filters.walletId);
    if (filters?.agentIds && filters.agentIds.length)
      rows = rows.filter((t) => filters.agentIds!.includes(t.agent_id));
    if (filters?.type && filters.type !== "all") {
      if (filters.type === "approved")
        rows = rows.filter((t) => t.decision === "approved");
      else if (filters.type === "rejected")
        rows = rows.filter((t) => t.decision === "rejected");
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          t.payee_url.toLowerCase().includes(q) ||
          t.agent_name.toLowerCase().includes(q),
      );
    }
    return structuredClone(rows);
  },

  async getTransaction(id): Promise<TransactionRequest> {
    await sleep(140);
    const tx = state.transactions.find((t) => t.id === id);
    if (!tx) throw new ApiError(404, "transaction_not_found");
    return structuredClone(tx);
  },

  async listAgents(): Promise<AgentIdentity[]> {
    await sleep(220);
    return structuredClone(state.agents);
  },

  async getAgent(id): Promise<AgentIdentity> {
    await sleep(160);
    return structuredClone(requireAgent(id));
  },

  async registerAgent(input: RegisterAgentInput): Promise<RegisterAgentResponse> {
    await sleep(560);
    requireWallet(input.wallet_id);
    const apiKey = genApiKey();
    const agent: AgentIdentity = {
      id: genId("agent"),
      wallet_id: input.wallet_id,
      owner_id: state.user.id,
      parent_id: input.parent_id ?? null,
      name: input.name,
      api_key_preview: apiKey.slice(-4),
      status: "active",
      hourly_limit_cents: input.hourly_limit_cents,
      per_tx_limit_cents: input.per_tx_limit_cents,
      daily_limit_cents: input.daily_limit_cents,
      allowed_domains: input.allowed_domains ?? [],
      blocked_domains: input.blocked_domains ?? [],
      created_at: new Date().toISOString(),
      last_seen_at: null,
    };
    state.agents.push(agent);
    state.policies.push({
      id: genId("pol"),
      agent_id: agent.id,
      version: 1,
      rules: {
        hourly_limit_cents: input.hourly_limit_cents,
        per_tx_limit_cents: input.per_tx_limit_cents,
        daily_limit_cents: input.daily_limit_cents,
        allowed_domains: input.allowed_domains ?? [],
        blocked_domains: input.blocked_domains ?? [],
        require_description: true,
        auto_suspend_on_anomaly: true,
      },
      is_active: true,
      created_by: state.user.id,
      created_at: new Date().toISOString(),
    });
    return {
      agent: structuredClone(agent),
      api_key: apiKey,
      warning: "Store this key securely. It will not be shown again.",
    };
  },

  async spawnAgent(parentId: string, input: SpawnAgentInput): Promise<SpawnAgentResponse> {
    await sleep(400);
    const parent = requireAgent(parentId);
    if (parent.status !== "active") {
      throw new Error("parent_not_active");
    }

    // Check can_spawn policy flag
    const parentPolicy = state.policies.find(
      (p) => p.agent_id === parentId && p.is_active,
    );
    if (parentPolicy?.rules.can_spawn === false) {
      throw new Error("spawn_not_permitted");
    }

    // Budget validation
    const effectiveHourly = input.hourly_limit_cents ?? parent.hourly_limit_cents;
    const effectivePerTx = input.per_tx_limit_cents ?? parent.per_tx_limit_cents;
    const effectiveDaily = input.daily_limit_cents;

    if (effectiveHourly > parent.hourly_limit_cents) {
      throw new Error("hourly_limit_exceeds_parent");
    }
    if (effectivePerTx > parent.per_tx_limit_cents) {
      throw new Error("per_tx_limit_exceeds_parent");
    }

    const siblings = state.agents.filter((a) => a.parent_id === parentId);
    const allocated = siblings.reduce((sum, s) => sum + s.daily_limit_cents, 0);
    const remaining = parent.daily_limit_cents - allocated;
    if (effectiveDaily > remaining) {
      throw new Error("daily_limit_exceeds_remaining");
    }

    // Domain inheritance
    const parentDomains = parent.allowed_domains ?? [];
    const childDomains = input.allowed_domains ?? [];
    if (parentDomains.length > 0 && childDomains.length > 0) {
      const invalid = childDomains.filter((d) => !parentDomains.includes(d));
      if (invalid.length > 0) {
        throw new Error("domains_not_subset_of_parent");
      }
    }
    const finalDomains =
      parentDomains.length > 0 && childDomains.length === 0
        ? parentDomains
        : childDomains;

    const apiKey = genApiKey();
    const agent: AgentIdentity = {
      id: genId("agent"),
      wallet_id: parent.wallet_id,
      owner_id: parent.owner_id,
      parent_id: parentId,
      name: input.name,
      api_key_preview: apiKey.slice(-4),
      status: "active",
      hourly_limit_cents: effectiveHourly,
      per_tx_limit_cents: effectivePerTx,
      daily_limit_cents: effectiveDaily,
      allowed_domains: finalDomains,
      blocked_domains: parent.blocked_domains ?? [],
      created_at: new Date().toISOString(),
      last_seen_at: null,
    };
    state.agents.push(agent);

    return {
      agent_id: agent.id,
      parent_id: parentId,
      api_key: apiKey,
      wallet_id: parent.wallet_id,
      limits: {
        hourly_limit_cents: effectiveHourly,
        per_tx_limit_cents: effectivePerTx,
        daily_limit_cents: effectiveDaily,
      },
      allowed_domains: finalDomains,
      warning: "Store this key securely. It will not be shown again.",
    };
  },

  async setAgentStatus(id, status): Promise<AgentIdentity> {
    await sleep(240);
    const a = requireAgent(id);
    a.status = status;
    // Process-tree teardown: suspending/revoking a parent cascades to its whole
    // subtree, mirroring the live backend. Reactivating is not cascaded.
    if (status === "suspended" || status === "revoked") {
      const queue = [a.id];
      const seen = new Set(queue);
      while (queue.length) {
        const current = queue.shift() as string;
        for (const child of state.agents) {
          if (child.parent_id === current && !seen.has(child.id)) {
            seen.add(child.id);
            child.status = status;
            queue.push(child.id);
          }
        }
      }
    }
    return structuredClone(a);
  },

  async getAgentAnalytics(id) {
    await sleep(140);
    return {
      spent_last_hour_cents: spentInWindow(id, 3_600_000),
      spent_today_cents: spentInWindow(id, 86_400_000),
    };
  },

  async getAgentSpendSeries(id): Promise<SpendPoint[]> {
    await sleep(160);
    return hourlySeries((e) => e.agent_id === id);
  },

  async listPolicies(agentId): Promise<SpendPolicy[]> {
    await sleep(180);
    return structuredClone(
      state.policies
        .filter((p) => p.agent_id === agentId)
        .sort((a, b) => b.version - a.version),
    );
  },

  async getActivePolicy(agentId): Promise<SpendPolicy | null> {
    await sleep(140);
    const p = state.policies.find((x) => x.agent_id === agentId && x.is_active);
    return p ? structuredClone(p) : null;
  },

  async updatePolicy(agentId, rules: PolicyRules): Promise<SpendPolicy> {
    await sleep(420);
    const agent = requireAgent(agentId);
    const versions = state.policies.filter((p) => p.agent_id === agentId);
    versions.forEach((p) => (p.is_active = false));
    const next: SpendPolicy = {
      id: genId("pol"),
      agent_id: agentId,
      version: versions.length + 1,
      rules,
      is_active: true,
      created_by: state.user.id,
      created_at: new Date().toISOString(),
    };
    state.policies.push(next);
    agent.hourly_limit_cents = rules.hourly_limit_cents;
    agent.per_tx_limit_cents = rules.per_tx_limit_cents;
    agent.daily_limit_cents = rules.daily_limit_cents;
    agent.allowed_domains = rules.allowed_domains ?? [];
    agent.blocked_domains = rules.blocked_domains ?? [];
    return structuredClone(next);
  },

  async createDeposit(input: CreateDepositInput): Promise<CreateDepositResponse> {
    await sleep(620);
    const wallet = requireWallet(input.wallet_id);
    const molliePaymentId = `tr_${Math.random().toString(36).slice(2, 12)}`;
    const payment: MolliePayment = {
      id: genId("pay"),
      user_id: state.user.id,
      wallet_id: wallet.id,
      mollie_payment_id: molliePaymentId,
      amount_cents: input.amount_cents,
      currency: "EUR",
      method: input.method,
      status: "open",
      checkout_url: `${window.location.origin}/wallets/deposit/success?payment_id=${molliePaymentId}`,
      webhook_received_at: null,
      created_at: new Date().toISOString(),
    };
    state.payments.push(payment);
    return {
      mollie_payment_id: molliePaymentId,
      checkout_url: payment.checkout_url,
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  },

  async getPaymentStatus(molliePaymentId): Promise<MolliePayment> {
    await sleep(420);
    const payment = state.payments.find(
      (p) => p.mollie_payment_id === molliePaymentId,
    );
    if (!payment) throw new ApiError(404, "payment_not_found");
    // Simulate Mollie settling the payment a few seconds after creation.
    const ageMs = Date.now() - new Date(payment.created_at).getTime();
    if (payment.status === "open" && ageMs > 4000) {
      payment.status = "paid";
      payment.webhook_received_at = new Date().toISOString();
      const wallet = requireWallet(payment.wallet_id);
      wallet.balance_cents += payment.amount_cents;
      if (wallet.status === "depleted") wallet.status = "active";
      wallet.updated_at = new Date().toISOString();
      state.ledger.push({
        id: genId("led"),
        wallet_id: wallet.id,
        agent_id: null,
        agent_name: null,
        type: "deposit",
        amount_cents: payment.amount_cents,
        balance_after_cents: wallet.balance_cents,
        description: `Wallet top-up via ${payment.method}`,
        payee_url: null,
        mollie_payment_id: molliePaymentId,
        payment_token: null,
        status: "settled",
        category: null,
        created_at: new Date().toISOString(),
      });
      emit();
    }
    return structuredClone(payment);
  },

  async getGcStatus(): Promise<GcStatus> {
    await sleep(140);
    const totalReclaimedCents = state.gcEvents.reduce(
      (sum, e) => sum + e.reclaimed_cents,
      0,
    );
    const totalLimitFreed = state.gcEvents.reduce(
      (sum, e) => sum + e.daily_limit_freed,
      0,
    );
    const lastEvent = state.gcEvents.length
      ? state.gcEvents[state.gcEvents.length - 1]
      : null;
    return {
      total_events: state.gcEvents.length,
      total_reclaimed_cents: totalReclaimedCents,
      total_limit_freed: totalLimitFreed,
      last_sweep_at: lastEvent?.created_at ?? null,
    };
  },

  async listGcEvents(): Promise<GcEvent[]> {
    await sleep(180);
    return structuredClone(state.gcEvents.slice().reverse());
  },

  async triggerSweep(ttlMs?: number): Promise<SweepResult> {
    void ttlMs;
    await sleep(600);
    return structuredClone(runMockSweep());
  },

  async getOobStatus(): Promise<OobStatus> {
    await sleep(140);
    const totalAgentsKilled = state.oobKillEvents.reduce(
      (sum, e) => sum + e.agents_killed,
      0,
    );
    const totalTokensInvalidated = state.oobKillEvents.reduce(
      (sum, e) => sum + e.tokens_invalidated,
      0,
    );
    const lastEvent = state.oobKillEvents.length
      ? state.oobKillEvents[state.oobKillEvents.length - 1]
      : null;
    return {
      total_events: state.oobKillEvents.length,
      total_agents_killed: totalAgentsKilled,
      total_tokens_invalidated: totalTokensInvalidated,
      last_triggered_at: lastEvent?.created_at ?? null,
    };
  },

  async listOobEvents(): Promise<OobKillEvent[]> {
    await sleep(180);
    return structuredClone(state.oobKillEvents.slice().reverse());
  },

  async simulateOobKill(walletId: string, thresholdCents?: number): Promise<OobSimulateResult> {
    await sleep(400);
    return structuredClone(runOobCheck(walletId, thresholdCents));
  },

  // ---- billing & monetization ------------------------------------------------

  async listPlans(): Promise<SaasPlan[]> {
    await sleep(140);
    return structuredClone(PLANS);
  },

  async getBillingAccount(): Promise<BillingAccount> {
    await sleep(180);
    return structuredClone(state.billingAccount);
  },

  async changePlan(tier: SaasTier): Promise<BillingAccount> {
    await sleep(520);
    const plan = PLANS.find((p) => p.tier === tier);
    if (!plan) throw new ApiError(400, "invalid_plan");
    state.billingAccount.tier = tier;
    state.billingAccount.tx_fee_bps = plan.tx_fee_bps;
    return structuredClone(state.billingAccount);
  },

  async listFeeEvents(): Promise<FeeEvent[]> {
    await sleep(180);
    return structuredClone(state.feeEvents.slice().reverse());
  },

  // ---- provider marketplace --------------------------------------------------

  async getProviderStats(): Promise<ProviderStats> {
    await sleep(140);
    const verified = state.providers.filter((p) => p.status === "verified").length;
    const pending = state.providers.filter((p) => p.status === "pending").length;
    const totalRevenue = state.providers.reduce((sum, p) => sum + p.total_revenue_cents, 0);
    return {
      total_providers: state.providers.length,
      verified_providers: verified,
      total_verification_revenue_cents: totalRevenue,
      pending_verifications: pending,
    };
  },

  async listProviders(): Promise<MarketplaceProvider[]> {
    await sleep(180);
    return structuredClone(state.providers);
  },

  async verifyProvider(id: string): Promise<MarketplaceProvider> {
    await sleep(400);
    const provider = state.providers.find((p) => p.id === id);
    if (!provider) throw new ApiError(404, "provider_not_found");
    provider.status = "verified";
    return structuredClone(provider);
  },

  // ---- white-label licensing -------------------------------------------------

  async getLicensingStats(): Promise<LicensingStats> {
    await sleep(140);
    const active = state.licenses.filter((l) => l.status === "active").length;
    const totalRevenue = state.licenses.reduce((sum, l) => sum + l.monthly_fee_cents, 0);
    const totalCalls = state.licenses.reduce((sum, l) => sum + l.api_calls_this_month, 0);
    return {
      total_licenses: state.licenses.length,
      active_licenses: active,
      total_monthly_revenue_cents: totalRevenue,
      total_api_calls: totalCalls,
    };
  },

  async listLicenses(): Promise<WhiteLabelLicense[]> {
    await sleep(180);
    return structuredClone(state.licenses);
  },
};
