import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  Radio,
  Bot,
  ShieldAlert,
  Recycle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { ProgressBar, meterTone } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/utils";

/* ---------- static mock data for previews ---------- */

const MOCK_FEED = [
  { id: 1, agent: "ResearchBot", amount: "€0.42", domain: "arxiv.org", approved: true, time: "14:32:08" },
  { id: 2, agent: "DataMiner-3", amount: "€1.85", domain: "api.crunchbase.com", approved: true, time: "14:32:05" },
  { id: 3, agent: "CodeAssist", amount: "€12.00", domain: "openai.com", approved: false, time: "14:31:59" },
  { id: 4, agent: "ResearchBot", amount: "€0.18", domain: "scholar.google.com", approved: true, time: "14:31:54" },
  { id: 5, agent: "MarketScanner", amount: "€0.67", domain: "api.polygon.io", approved: true, time: "14:31:50" },
  { id: 6, agent: "DataMiner-1", amount: "€0.91", domain: "api.clearbit.com", approved: true, time: "14:31:44" },
  { id: 7, agent: "ResearchBot", amount: "€0.33", domain: "pubmed.ncbi.nlm.nih.gov", approved: true, time: "14:31:38" },
];

const MOCK_AGENTS = [
  { name: "ResearchBot", status: "active" as const, hourlyPct: 34, spent: "€4.20", limit: "€12.50" },
  { name: "DataMiner-1", status: "active" as const, hourlyPct: 67, spent: "€8.40", limit: "€12.50" },
  { name: "DataMiner-3", status: "active" as const, hourlyPct: 88, spent: "€11.00", limit: "€12.50" },
  { name: "CodeAssist", status: "suspended" as const, hourlyPct: 0, spent: "—", limit: "—" },
];

const TERMINAL_LINES = [
  { type: "comment" as const, text: "# Agent hits paywall — HTTP 402 Payment Required" },
  { type: "cmd" as const, text: "curl -X POST https://api.fluxxx.dev/v1/spend \\" },
  { type: "cmd" as const, text: '  -H "Authorization: Bearer agent_sk_res..." \\' },
  { type: "cmd" as const, text: '  -d \'{"amount_cents": 42, "payee": "https://arxiv.org/api/paper/2401.1234"}\'' },
  { type: "blank" as const, text: "" },
  { type: "response" as const, text: "→ Policy Engine: 5 checks evaluated" },
  { type: "check" as const, text: "  ✓ per_tx_limit:  €0.42 ≤ €5.00" },
  { type: "check" as const, text: "  ✓ hourly_spent:  €4.62 ≤ €12.50" },
  { type: "check" as const, text: "  ✓ daily_spent:   €18.90 ≤ €50.00" },
  { type: "check" as const, text: "  ✓ balance:       €247.30 ≥ €0.42" },
  { type: "check" as const, text: "  ✓ domain:        arxiv.org — allowed" },
  { type: "blank" as const, text: "" },
  { type: "success" as const, text: '{ "decision": "approved", "token": "tok_7f3a...c9e1", "expires_in": 30 }' },
];

/* ---------- animated terminal ---------- */

function TerminalDemo() {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    if (visibleLines >= TERMINAL_LINES.length) return;
    const delay = TERMINAL_LINES[visibleLines]?.type === "blank" ? 200 : 120;
    const timer = setTimeout(() => setVisibleLines((v) => v + 1), delay);
    return () => clearTimeout(timer);
  }, [visibleLines]);

  useEffect(() => {
    if (visibleLines < TERMINAL_LINES.length) return;
    const timer = setTimeout(() => setVisibleLines(0), 4000);
    return () => clearTimeout(timer);
  }, [visibleLines]);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-[#080c14] font-mono text-[13px] leading-relaxed shadow-card">
      <div className="flex items-center gap-2 border-b border-line/60 px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-flux-red/70" />
        <span className="h-3 w-3 rounded-full bg-flux-amber/70" />
        <span className="h-3 w-3 rounded-full bg-flux-green/70" />
        <span className="ml-2 text-xs text-ink-faint">fluxxx — policy evaluation</span>
      </div>
      <div className="min-h-[340px] p-4">
        {TERMINAL_LINES.slice(0, visibleLines).map((line, i) => (
          <div key={i} className={cn(
            "whitespace-pre-wrap",
            line.type === "comment" && "text-ink-faint",
            line.type === "cmd" && "text-flux-cyan",
            line.type === "response" && "text-flux-violet",
            line.type === "check" && "text-flux-green",
            line.type === "success" && "text-flux-amber",
            line.type === "blank" && "h-4",
          )}>
            {line.text}
          </div>
        ))}
        {visibleLines < TERMINAL_LINES.length && (
          <span className="inline-block h-4 w-2 animate-pulse bg-flux-cyan" />
        )}
      </div>
    </div>
  );
}

/* ---------- mock live feed ---------- */

function MockLiveFeed() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-bg-soft/80 shadow-card">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-sm font-semibold text-ink">Live Ledger</p>
        <span className="flex items-center gap-1.5 text-xs font-medium text-flux-green">
          <Radio className="h-3.5 w-3.5 animate-pulse-dot" /> streaming
        </span>
      </div>
      <ul>
        {MOCK_FEED.map((row) => (
          <li
            key={row.id}
            className="flex items-center gap-3 border-b border-line/50 px-4 py-2.5 text-sm last:border-0"
          >
            {row.approved ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-flux-green" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 text-flux-red" />
            )}
            <span className="w-16 shrink-0 font-mono text-xs text-ink-muted">{row.time}</span>
            <span className="flex-1 truncate text-ink">{row.agent}</span>
            {row.approved ? (
              <span className="font-mono font-medium text-ink">-{row.amount}</span>
            ) : (
              <span className="text-xs font-semibold uppercase text-flux-red">rejected</span>
            )}
            <span className="w-24 shrink-0 truncate text-right text-xs text-ink-muted">
              {row.approved ? row.domain : "per_tx_limit_exceeded"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- mock agent panel ---------- */

function MockAgentPanel() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-bg-soft/80 shadow-card">
      <div className="border-b border-line px-4 py-3">
        <p className="text-sm font-semibold text-ink">Agents ({MOCK_AGENTS.length})</p>
      </div>
      <div className="space-y-2 p-3">
        {MOCK_AGENTS.map((a) => {
          const dot = a.status === "active" ? "bg-flux-green" : "bg-flux-amber";
          return (
            <div
              key={a.name}
              className="rounded-lg border border-line bg-bg-raised/30 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", dot)} />
                  <span className="text-sm font-medium text-ink">{a.name}</span>
                </span>
                {a.status !== "active" && (
                  <span className="text-xs capitalize text-ink-muted">{a.status}</span>
                )}
              </div>
              {a.status === "active" && (
                <div className="mt-2.5">
                  <div className="flex items-center justify-between text-xs text-ink-muted">
                    <span>Hourly burn</span>
                    <span className="font-mono">{a.spent} / {a.limit}</span>
                  </div>
                  <ProgressBar percent={a.hourlyPct} tone={meterTone(a.hourlyPct)} className="mt-1.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- mock wallet card ---------- */

function MockWalletCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-bg-soft/80 shadow-card">
      <div className="relative p-5">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-30 blur-2xl"
          style={{ background: "radial-gradient(circle, rgba(34,211,238,0.5), transparent 70%)" }}
        />
        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Production Wallet</p>
            <span className="rounded-full bg-flux-green/15 px-2 py-0.5 text-xs font-semibold text-flux-green">
              active
            </span>
          </div>
          <p className="mt-5 text-xs font-medium uppercase tracking-wide text-ink-muted">Balance</p>
          <p className="mt-1 font-mono text-4xl font-bold tracking-tight text-ink">€247.30</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-line bg-bg-raised/40 p-3">
              <p className="flex items-center gap-1 text-xs text-ink-muted">
                <TrendingUp className="h-3.5 w-3.5 text-flux-green" /> Deposited
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-ink">€500.00</p>
            </div>
            <div className="rounded-lg border border-line bg-bg-raised/40 p-3">
              <p className="flex items-center gap-1 text-xs text-ink-muted">
                <TrendingDown className="h-3.5 w-3.5 text-flux-amber" /> Spent
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-ink">€252.70</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- process tree ---------- */

function ProcessTree() {
  const [killedStep, setKilledStep] = useState(0);

  useEffect(() => {
    if (killedStep >= 3) return;
    const timer = setTimeout(() => setKilledStep((s) => s + 1), 2000);
    return () => clearTimeout(timer);
  }, [killedStep]);

  useEffect(() => {
    if (killedStep < 3) return;
    const timer = setTimeout(() => setKilledStep(0), 5000);
    return () => clearTimeout(timer);
  }, [killedStep]);

  const nodes = [
    { id: "root", name: "ResearchBot", x: 200, y: 30, parent: null, essential: true },
    { id: "c1", name: "DataMiner-1", x: 80, y: 110, parent: "root", essential: false },
    { id: "c2", name: "DataMiner-2", x: 200, y: 110, parent: "root", essential: false },
    { id: "c3", name: "DataMiner-3", x: 320, y: 110, parent: "root", essential: false },
    { id: "gc1", name: "Scraper-A", x: 50, y: 190, parent: "c1", essential: false },
    { id: "gc2", name: "Scraper-B", x: 140, y: 190, parent: "c1", essential: false },
  ];

  const isKilled = (id: string) => {
    if (killedStep === 0) return false;
    const nonEssential = nodes.filter((n) => !n.essential).map((n) => n.id);
    const idx = nonEssential.indexOf(id);
    return idx !== -1 && idx < killedStep * 2;
  };

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-bg-soft/80 p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Agent Process Tree</p>
        {killedStep > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-flux-red/15 px-2.5 py-1 text-xs font-semibold text-flux-red">
            <ShieldAlert className="h-3 w-3" /> OOB Killer active
          </span>
        )}
      </div>
      <svg viewBox="0 0 400 230" className="w-full">
        {nodes.map((node) => {
          const parent = nodes.find((n) => n.id === node.parent);
          if (!parent) return null;
          const killed = isKilled(node.id);
          return (
            <line
              key={`line-${node.id}`}
              x1={parent.x}
              y1={parent.y + 18}
              x2={node.x}
              y2={node.y}
              className={cn(
                "transition-all duration-500",
                killed ? "stroke-flux-red/30" : "stroke-line",
              )}
              strokeWidth={1.5}
            />
          );
        })}
        {nodes.map((node) => {
          const killed = isKilled(node.id);
          return (
            <g key={node.id}>
              <rect
                x={node.x - 48}
                y={node.y}
                width={96}
                height={28}
                rx={6}
                className={cn(
                  "transition-all duration-500",
                  killed
                    ? "fill-flux-red/10 stroke-flux-red/40"
                    : node.essential
                      ? "fill-flux-cyan/10 stroke-flux-cyan/40"
                      : "fill-bg-raised stroke-line",
                )}
                strokeWidth={1}
              />
              <text
                x={node.x}
                y={node.y + 17}
                textAnchor="middle"
                className={cn(
                  "text-[10px] font-medium transition-all duration-500",
                  killed ? "fill-flux-red/50" : "fill-ink",
                )}
              >
                {node.name}
              </text>
              {killed && (
                <text
                  x={node.x}
                  y={node.y + 42}
                  textAnchor="middle"
                  className="text-[9px] font-bold uppercase fill-flux-red"
                >
                  killed
                </text>
              )}
              {node.essential && killedStep > 0 && (
                <text
                  x={node.x}
                  y={node.y + 42}
                  textAnchor="middle"
                  className="text-[9px] font-bold uppercase fill-flux-green"
                >
                  protected
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-center text-xs text-ink-faint">
        {killedStep === 0
          ? "Hierarchical agent governance — parent controls children"
          : "OOB Killer terminates non-essential agents to protect root budget"}
      </p>
    </div>
  );
}

/* ---------- main page ---------- */

export function HomePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-line bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <LogoMark />
            <span className="bg-gradient-to-r from-flux-cyan to-flux-violet bg-clip-text text-lg font-bold tracking-tight text-transparent">
              FLUXXX
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Link to="/dashboard" className="btn-primary text-sm">
                Command Center <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn-ghost text-sm">Sign in</Link>
                <Link to="/register" className="btn-primary text-sm">Get started</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(50rem 50rem at 50% 0%, rgba(34,211,238,0.10), transparent 60%), radial-gradient(40rem 40rem at 80% 40%, rgba(139,92,246,0.08), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-16 sm:px-6 sm:pt-20">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-flux-cyan">
            Agentic Commerce Gateway
          </p>
          <h1 className="mt-4 max-w-2xl text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl lg:text-5xl">
            The financial OS{" "}
            <span className="bg-gradient-to-r from-flux-cyan to-flux-violet bg-clip-text text-transparent">
              for AI agents
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-ink-muted">
            Give your agents purchasing power. Keep the kill switch.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {user ? (
              <Link to="/dashboard" className="btn-primary">
                Open Command Center <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn-primary">
                  Start building <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/login" className="btn-ghost">Sign in</Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Live dashboard preview */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-4 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <MockWalletCard />
            </div>
            <div className="lg:col-span-6">
              <MockLiveFeed />
            </div>
            <div className="lg:col-span-3">
              <MockAgentPanel />
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-ink-faint">
            Live command center — real-time visibility into agent spend across your fleet
          </p>
        </div>
      </section>

      {/* Terminal demo + Process tree */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-flux-cyan">
                How it works
              </p>
              <h2 className="mt-2 text-xl font-bold text-ink sm:text-2xl">
                HTTP 402 — policy evaluation in real time
              </h2>
              <p className="mb-5 mt-2 max-w-md text-sm text-ink-muted">
                Agent requests spend. Policy engine evaluates 5 atomic checks.
                Approved requests get a 30-second single-use payment token.
              </p>
              <TerminalDemo />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-flux-violet">
                OS-inspired governance
              </p>
              <h2 className="mt-2 text-xl font-bold text-ink sm:text-2xl">
                Agent Process Tree + OOB Killer
              </h2>
              <p className="mb-5 mt-2 max-w-md text-sm text-ink-muted">
                Hierarchical parent-child agents with cascading revocation.
                When budget runs low, OOB Killer terminates non-essential children.
              </p>
              <ProcessTree />
            </div>
          </div>
        </div>
      </section>

      {/* Core capabilities */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Bot, label: "Agent Fleet", value: "Hierarchical identity with cascading revocation", tone: "text-flux-cyan" },
              { icon: ShieldAlert, label: "OOB Killer", value: "Auto-terminate non-essential agents at budget threshold", tone: "text-flux-red" },
              { icon: Recycle, label: "Capital Reclamation", value: "Detect zombie agents, revoke access, release held funds", tone: "text-flux-green" },
              { icon: CheckCircle2, label: "Approval Queue", value: "Human-in-the-loop for high-value transactions", tone: "text-flux-amber" },
            ].map(({ icon: Icon, label, value, tone }) => (
              <div key={label} className="bg-bg-soft/80 p-5">
                <Icon className={cn("mb-3 h-5 w-5", tone)} />
                <p className="text-sm font-semibold text-ink">{label}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integration code */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="lg:grid lg:grid-cols-2 lg:gap-12">
            <div className="flex flex-col justify-center">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-flux-green">
                Integration
              </p>
              <h2 className="mt-2 text-xl font-bold text-ink sm:text-2xl">
                Three lines to governed spend
              </h2>
              <p className="mt-2 max-w-md text-sm text-ink-muted">
                Your agent requests spend through FLUXXX. Policy engine decides.
                Single-use token settles payment. Full audit trail, zero trust
                delegation to the agent.
              </p>
              <div className="mt-5">
                {user ? (
                  <Link to="/dashboard" className="btn-primary text-sm">
                    Open dashboard <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <Link to="/register" className="btn-primary text-sm">
                    Create free account <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
            <div className="mt-8 lg:mt-0">
              <div className="overflow-hidden rounded-xl border border-line bg-[#080c14] font-mono text-[13px] shadow-card">
                <div className="flex items-center gap-2 border-b border-line/60 px-4 py-2.5">
                  <span className="h-3 w-3 rounded-full bg-flux-red/70" />
                  <span className="h-3 w-3 rounded-full bg-flux-amber/70" />
                  <span className="h-3 w-3 rounded-full bg-flux-green/70" />
                  <span className="ml-2 text-xs text-ink-faint">agent.ts</span>
                </div>
                <div className="p-4 leading-relaxed">
                  <p className="text-ink-faint">{"// Agent requests access to paid API"}</p>
                  <p>
                    <span className="text-flux-violet">const</span>{" "}
                    <span className="text-ink">result</span>{" "}
                    <span className="text-flux-cyan">=</span>{" "}
                    <span className="text-flux-violet">await</span>{" "}
                    <span className="text-flux-cyan">flux</span>
                    <span className="text-ink">.spend({"{"}</span>
                  </p>
                  <p className="pl-4">
                    <span className="text-flux-green">amount_cents</span>
                    <span className="text-ink">:</span>{" "}
                    <span className="text-flux-amber">42</span>
                    <span className="text-ink">,</span>
                  </p>
                  <p className="pl-4">
                    <span className="text-flux-green">payee</span>
                    <span className="text-ink">:</span>{" "}
                    <span className="text-flux-amber">{'"https://arxiv.org/api"'}</span>
                    <span className="text-ink">,</span>
                  </p>
                  <p className="pl-4">
                    <span className="text-flux-green">description</span>
                    <span className="text-ink">:</span>{" "}
                    <span className="text-flux-amber">{'"Paper download"'}</span>
                  </p>
                  <p><span className="text-ink">{"}"})</span></p>
                  <p className="mt-2 text-ink-faint">{"// → { decision: 'approved', token: 'tok_7f3a...', ttl: 30 }"}</p>
                  <p className="text-ink-faint">{"// → Full audit trail in append-only ledger"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">
              Ready to govern your agent fleet?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-ink-muted">
              Set up a wallet, register an agent, watch transactions stream in.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {user ? (
                <Link to="/dashboard" className="btn-primary">
                  Go to Command Center <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link to="/register" className="btn-primary">
                    Create free account <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link to="/login" className="btn-ghost">Sign in</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LogoMark className="h-5 w-5" />
              <span className="text-sm font-semibold text-ink-muted">FLUXXX</span>
            </div>
            <p className="text-xs text-ink-faint">
              Agentic Commerce Gateway
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
