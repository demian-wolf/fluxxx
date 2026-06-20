import type {
  AgentIdentity,
  AgentWallet,
  LedgerEntry,
  MolliePayment,
  PolicyCheck,
  SpendPolicy,
  TransactionRequest,
  User,
} from "@/types";

export function genId(prefix: string): string {
  const rand = Math.random().toString(16).slice(2, 10);
  return `${prefix}_${rand}${Date.now().toString(16).slice(-4)}`;
}

export function genToken(): string {
  return `flux_tok_${Math.random().toString(16).slice(2, 10)}cd${Math.random()
    .toString(16)
    .slice(2, 6)}`;
}

export function genApiKey(): string {
  const body = Array.from({ length: 24 }, () =>
    "abcdefghijklmnopqrstuvwxyz0123456789".charAt(
      Math.floor(Math.random() * 36),
    ),
  ).join("");
  return `flux_sk_live_${body}`;
}

const now = Date.now();
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();
const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();

export interface MockState {
  user: User;
  sessionToken: string | null;
  wallets: AgentWallet[];
  agents: AgentIdentity[];
  policies: SpendPolicy[];
  ledger: LedgerEntry[];
  transactions: TransactionRequest[];
  payments: MolliePayment[];
}

const OPERATOR_ID = "user_operator01";
const WALLET_RESEARCH = "wallet_research01";
const WALLET_OPS = "wallet_ops02";
const AGENT_RESEARCH = "agent_researchbot1";
const AGENT_DATAMINER = "agent_dataminer2";
const AGENT_SCRAPER = "agent_scraper3";

function checks(
  spec: Array<[string, string, boolean]>,
): PolicyCheck[] {
  return spec.map(([rule, label, passed]) => ({ rule, label, passed }));
}

export function createInitialState(): MockState {
  const user: User = {
    id: OPERATOR_ID,
    email: "operator@flux.dev",
    full_name: "Alex Rivera",
    mollie_customer_id: "cst_8wmqcHMN4U",
    created_at: hoursAgo(720),
  };

  const wallets: AgentWallet[] = [
    {
      id: WALLET_RESEARCH,
      owner_id: OPERATOR_ID,
      name: "ResearchBot Budget",
      balance_cents: 1990,
      currency: "EUR",
      status: "active",
      created_at: hoursAgo(72),
      updated_at: minutesAgo(2),
    },
    {
      id: WALLET_OPS,
      owner_id: OPERATOR_ID,
      name: "Ops Automation",
      balance_cents: 4725,
      currency: "EUR",
      status: "active",
      created_at: hoursAgo(48),
      updated_at: minutesAgo(40),
    },
  ];

  const agents: AgentIdentity[] = [
    {
      id: AGENT_RESEARCH,
      wallet_id: WALLET_RESEARCH,
      owner_id: OPERATOR_ID,
      name: "ResearchBot v1",
      api_key_preview: "a4f9",
      status: "active",
      hourly_limit_cents: 200,
      per_tx_limit_cents: 10,
      daily_limit_cents: 1000,
      allowed_domains: ["dataset.io", "arxiv.org", "openai.com"],
      blocked_domains: [],
      created_at: hoursAgo(70),
      last_seen_at: minutesAgo(0),
    },
    {
      id: AGENT_DATAMINER,
      wallet_id: WALLET_RESEARCH,
      owner_id: OPERATOR_ID,
      name: "DataMiner",
      api_key_preview: "9c1b",
      status: "suspended",
      hourly_limit_cents: 500,
      per_tx_limit_cents: 25,
      daily_limit_cents: 3000,
      allowed_domains: [],
      blocked_domains: ["gambling.com"],
      created_at: hoursAgo(50),
      last_seen_at: hoursAgo(2),
    },
    {
      id: AGENT_SCRAPER,
      wallet_id: WALLET_OPS,
      owner_id: OPERATOR_ID,
      name: "CrawlerOps",
      api_key_preview: "2e7d",
      status: "active",
      hourly_limit_cents: 800,
      per_tx_limit_cents: 50,
      daily_limit_cents: 5000,
      allowed_domains: [],
      blocked_domains: ["gambling.com", "ads.example.com"],
      created_at: hoursAgo(40),
      last_seen_at: minutesAgo(12),
    },
  ];

  const policies: SpendPolicy[] = [
    {
      id: genId("pol"),
      agent_id: AGENT_RESEARCH,
      version: 1,
      rules: {
        hourly_limit_cents: 100,
        per_tx_limit_cents: 5,
        daily_limit_cents: 500,
        allowed_categories: ["data", "api_access"],
        allowed_domains: ["dataset.io"],
        blocked_domains: [],
        require_description: true,
        auto_suspend_on_anomaly: true,
      },
      is_active: false,
      created_by: OPERATOR_ID,
      created_at: hoursAgo(70),
    },
    {
      id: genId("pol"),
      agent_id: AGENT_RESEARCH,
      version: 2,
      rules: {
        hourly_limit_cents: 200,
        per_tx_limit_cents: 10,
        daily_limit_cents: 1000,
        allowed_categories: ["data", "api_access", "compute"],
        allowed_domains: ["dataset.io", "arxiv.org", "openai.com"],
        blocked_domains: [],
        require_description: true,
        auto_suspend_on_anomaly: true,
      },
      is_active: true,
      created_by: OPERATOR_ID,
      created_at: hoursAgo(20),
    },
    {
      id: genId("pol"),
      agent_id: AGENT_DATAMINER,
      version: 1,
      rules: {
        hourly_limit_cents: 500,
        per_tx_limit_cents: 25,
        daily_limit_cents: 3000,
        allowed_categories: ["data", "compute"],
        allowed_domains: [],
        blocked_domains: ["gambling.com"],
        require_description: false,
        auto_suspend_on_anomaly: true,
      },
      is_active: true,
      created_by: OPERATOR_ID,
      created_at: hoursAgo(50),
    },
    {
      id: genId("pol"),
      agent_id: AGENT_SCRAPER,
      version: 1,
      rules: {
        hourly_limit_cents: 800,
        per_tx_limit_cents: 50,
        daily_limit_cents: 5000,
        allowed_categories: ["data", "api_access", "compute"],
        allowed_domains: [],
        blocked_domains: ["gambling.com", "ads.example.com"],
        require_description: false,
        auto_suspend_on_anomaly: false,
      },
      is_active: true,
      created_by: OPERATOR_ID,
      created_at: hoursAgo(40),
    },
  ];

  const ledger: LedgerEntry[] = [
    {
      id: genId("led"),
      wallet_id: WALLET_RESEARCH,
      agent_id: null,
      agent_name: null,
      type: "deposit",
      amount_cents: 2000,
      balance_after_cents: 2000,
      description: "Wallet top-up via iDEAL",
      payee_url: null,
      mollie_payment_id: "tr_WDqYK6vllg",
      payment_token: null,
      status: "settled",
      category: null,
      created_at: minutesAgo(64),
    },
    {
      id: genId("led"),
      wallet_id: WALLET_RESEARCH,
      agent_id: AGENT_RESEARCH,
      agent_name: "ResearchBot v1",
      type: "spend",
      amount_cents: 5,
      balance_after_cents: 1995,
      description: "Unlock climate dataset chunk #41",
      payee_url: "https://dataset.io/api/v1/datasets/climate/chunk/41",
      mollie_payment_id: null,
      payment_token: genToken(),
      status: "settled",
      category: "data",
      created_at: minutesAgo(1.4),
    },
    {
      id: genId("led"),
      wallet_id: WALLET_RESEARCH,
      agent_id: AGENT_RESEARCH,
      agent_name: "ResearchBot v1",
      type: "spend",
      amount_cents: 5,
      balance_after_cents: 1990,
      description: "Unlock climate dataset chunk #42",
      payee_url: "https://dataset.io/api/v1/datasets/climate/chunk/42",
      mollie_payment_id: null,
      payment_token: genToken(),
      status: "settled",
      category: "data",
      created_at: minutesAgo(1.0),
    },
    {
      id: genId("led"),
      wallet_id: WALLET_OPS,
      agent_id: null,
      agent_name: null,
      type: "deposit",
      amount_cents: 5000,
      balance_after_cents: 5000,
      description: "Wallet top-up via Credit Card",
      payee_url: null,
      mollie_payment_id: "tr_K9aZxQ2bdP",
      payment_token: null,
      status: "settled",
      category: null,
      created_at: hoursAgo(47),
    },
    {
      id: genId("led"),
      wallet_id: WALLET_OPS,
      agent_id: AGENT_SCRAPER,
      agent_name: "CrawlerOps",
      type: "spend",
      amount_cents: 275,
      balance_after_cents: 4725,
      description: "Proxy pool lease — 1h window",
      payee_url: "https://proxymesh.io/api/lease",
      mollie_payment_id: null,
      payment_token: genToken(),
      status: "settled",
      category: "api_access",
      created_at: minutesAgo(41),
    },
  ];

  const transactions: TransactionRequest[] = [
    {
      id: genId("tx"),
      agent_id: AGENT_RESEARCH,
      agent_name: "ResearchBot v1",
      wallet_id: WALLET_RESEARCH,
      wallet_name: "ResearchBot Budget",
      requested_amount_cents: 5,
      payee_url: "https://dataset.io/api/v1/datasets/climate/chunk/42",
      description: "Unlock climate dataset chunk #42",
      category: "data",
      decision: "approved",
      rejection_reason: null,
      payment_token: ledger[2].payment_token,
      token_expires_at: new Date(
        new Date(ledger[2].created_at).getTime() + 30_000,
      ).toISOString(),
      token_used_at: new Date(
        new Date(ledger[2].created_at).getTime() + 342,
      ).toISOString(),
      ledger_entry_id: ledger[2].id,
      balance_before_cents: 1995,
      balance_after_cents: 1990,
      policy_checks: checks([
        ["per_tx_limit", "per_tx_limit: €0.05 ≤ €0.10", true],
        ["hourly_spent", "hourly_spent: €0.05 ≤ €2.00", true],
        ["daily_spent", "daily_spent: €0.10 ≤ €10.00", true],
        ["balance", "balance_before: €19.95 ≥ €0.05", true],
        ["domain", "domain allowed: dataset.io ✓", true],
      ]),
      created_at: ledger[2].created_at,
    },
    {
      id: genId("tx"),
      agent_id: AGENT_RESEARCH,
      agent_name: "ResearchBot v1",
      wallet_id: WALLET_RESEARCH,
      wallet_name: "ResearchBot Budget",
      requested_amount_cents: 5,
      payee_url: "https://dataset.io/api/v1/datasets/climate/chunk/41",
      description: "Unlock climate dataset chunk #41",
      category: "data",
      decision: "approved",
      rejection_reason: null,
      payment_token: ledger[1].payment_token,
      token_expires_at: new Date(
        new Date(ledger[1].created_at).getTime() + 30_000,
      ).toISOString(),
      token_used_at: new Date(
        new Date(ledger[1].created_at).getTime() + 410,
      ).toISOString(),
      ledger_entry_id: ledger[1].id,
      balance_before_cents: 2000,
      balance_after_cents: 1995,
      policy_checks: checks([
        ["per_tx_limit", "per_tx_limit: €0.05 ≤ €0.10", true],
        ["hourly_spent", "hourly_spent: €0.05 ≤ €2.00", true],
        ["daily_spent", "daily_spent: €0.05 ≤ €10.00", true],
        ["balance", "balance_before: €20.00 ≥ €0.05", true],
        ["domain", "domain allowed: dataset.io ✓", true],
      ]),
      created_at: ledger[1].created_at,
    },
    {
      id: genId("tx"),
      agent_id: AGENT_RESEARCH,
      agent_name: "ResearchBot v1",
      wallet_id: WALLET_RESEARCH,
      wallet_name: "ResearchBot Budget",
      requested_amount_cents: 12,
      payee_url: "https://arxiv.org/api/premium/paper/2406.12345",
      description: "Fetch premium preprint PDF",
      category: "data",
      decision: "rejected",
      rejection_reason: "per_tx_limit_exceeded",
      payment_token: null,
      token_expires_at: null,
      token_used_at: null,
      ledger_entry_id: null,
      balance_before_cents: 1990,
      balance_after_cents: null,
      policy_checks: checks([
        ["per_tx_limit", "per_tx_limit: €0.12 ≤ €0.10", false],
        ["hourly_spent", "hourly_spent: €0.10 ≤ €2.00", true],
        ["daily_spent", "daily_spent: €0.10 ≤ €10.00", true],
        ["balance", "balance_before: €19.90 ≥ €0.12", true],
        ["domain", "domain allowed: arxiv.org ✓", true],
      ]),
      created_at: minutesAgo(0.6),
    },
    {
      id: genId("tx"),
      agent_id: AGENT_SCRAPER,
      agent_name: "CrawlerOps",
      wallet_id: WALLET_OPS,
      wallet_name: "Ops Automation",
      requested_amount_cents: 275,
      payee_url: "https://proxymesh.io/api/lease",
      description: "Proxy pool lease — 1h window",
      category: "api_access",
      decision: "approved",
      rejection_reason: null,
      payment_token: ledger[4].payment_token,
      token_expires_at: new Date(
        new Date(ledger[4].created_at).getTime() + 30_000,
      ).toISOString(),
      token_used_at: new Date(
        new Date(ledger[4].created_at).getTime() + 188,
      ).toISOString(),
      ledger_entry_id: ledger[4].id,
      balance_before_cents: 5000,
      balance_after_cents: 4725,
      policy_checks: checks([
        ["per_tx_limit", "per_tx_limit: €2.75 ≤ €0.50", false],
        ["hourly_spent", "hourly_spent: €2.75 ≤ €8.00", true],
        ["daily_spent", "daily_spent: €2.75 ≤ €50.00", true],
        ["balance", "balance_before: €50.00 ≥ €2.75", true],
        ["domain", "domain allowed: proxymesh.io ✓", true],
      ]),
      created_at: ledger[4].created_at,
    },
  ];

  return {
    user,
    sessionToken: null,
    wallets,
    agents,
    policies,
    ledger,
    transactions,
    payments: [],
  };
}

export const SEED_PAYEES = [
  { url: "https://dataset.io/api/v1/datasets/climate/chunk/", desc: "Unlock climate dataset chunk #", category: "data" },
  { url: "https://arxiv.org/api/premium/paper/", desc: "Fetch premium preprint #", category: "data" },
  { url: "https://openai.com/v1/embeddings/batch/", desc: "Embed document batch #", category: "compute" },
  { url: "https://serpapi.com/search/", desc: "Search API query #", category: "api_access" },
];
