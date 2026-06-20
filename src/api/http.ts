import type {
  CreateWalletInput,
  FluxApi,
  LoginInput,
  RegisterInput,
  TransactionFilters,
} from "@/api/types";
import type {
  AgentIdentity,
  AgentWallet,
  AuthResponse,
  CreateDepositInput,
  CreateDepositResponse,
  LedgerEntry,
  MolliePayment,
  PolicyRules,
  RegisterAgentInput,
  RegisterAgentResponse,
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

  return {
    async login(input: LoginInput): Promise<AuthResponse> {
      const res = await req<AuthResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      });
      localStorage.setItem(SESSION_KEY, res.session_token);
      return res;
    },
    async register(input: RegisterInput): Promise<AuthResponse> {
      const res = await req<AuthResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
      localStorage.setItem(SESSION_KEY, res.session_token);
      return res;
    },
    async currentUser(): Promise<User | null> {
      if (!localStorage.getItem(SESSION_KEY)) return null;
      try {
        return await req<User>("/api/auth/me");
      } catch {
        return null;
      }
    },
    async logout(): Promise<void> {
      try {
        await req<void>("/api/auth/logout", { method: "POST" });
      } finally {
        localStorage.removeItem(SESSION_KEY);
      }
    },
    updateProfile(input) {
      return req<User>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    },

    listWallets: () => req<AgentWallet[]>("/api/wallets"),
    getWallet: (id) => req<AgentWallet>(`/api/wallets/${id}`),
    createWallet: (input: CreateWalletInput) =>
      req<AgentWallet>("/api/wallets", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    setWalletStatus: (id, status) =>
      req<AgentWallet>(`/api/wallets/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    getWalletAnalytics: (id) =>
      req<WalletAnalytics>(`/api/wallets/${id}/analytics`),
    getWalletSpendSeries: (id) =>
      req<SpendPoint[]>(`/api/wallets/${id}/spend-series`),

    listLedger: (walletId) =>
      req<LedgerEntry[]>(`/api/wallets/${walletId}/ledger`),
    listTransactions: (filters?: TransactionFilters) =>
      req<TransactionRequest[]>(
        "/api/transactions" +
          qs({
            wallet_id: filters?.walletId,
            agent_ids: filters?.agentIds?.join(","),
            type: filters?.type,
            search: filters?.search,
          }),
      ),
    getTransaction: (id) => req<TransactionRequest>(`/api/transactions/${id}`),

    listAgents: () => req<AgentIdentity[]>("/api/agents"),
    getAgent: (id) => req<AgentIdentity>(`/api/agents/${id}`),
    registerAgent: (input: RegisterAgentInput) =>
      req<RegisterAgentResponse>("/api/agents/register", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    setAgentStatus: (id, status) =>
      req<AgentIdentity>(`/api/agents/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    getAgentAnalytics: (id) =>
      req<{ spent_last_hour_cents: number; spent_today_cents: number }>(
        `/api/agents/${id}/analytics`,
      ),
    getAgentSpendSeries: (id) =>
      req<SpendPoint[]>(`/api/agents/${id}/spend-series`),

    listPolicies: (agentId) =>
      req<SpendPolicy[]>(`/api/agents/${agentId}/policies`),
    getActivePolicy: (agentId) =>
      req<SpendPolicy | null>(`/api/agents/${agentId}/policies/active`),
    updatePolicy: (agentId, rules: PolicyRules) =>
      req<SpendPolicy>(`/api/agents/${agentId}/policy`, {
        method: "POST",
        body: JSON.stringify({ rules }),
      }),

    createDeposit: (input: CreateDepositInput) =>
      req<CreateDepositResponse>("/api/payments/deposit", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    getPaymentStatus: (molliePaymentId) =>
      req<MolliePayment>(`/api/payments/${molliePaymentId}/status`),
  };
}
