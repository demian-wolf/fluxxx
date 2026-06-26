import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  ShieldCheck,
  Activity,
  Gauge,
  Zap,
  GitBranch,
  ShieldAlert,
  Recycle,
  Eye,
  CheckCircle,
  TrendingDown,
  ReceiptText,
  Bell,
  Wallet,
} from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";

const features = [
  {
    icon: ShieldCheck,
    title: "KYA Policy Engine",
    body: "Per-transaction, hourly, and daily spend caps enforced atomically. Domain allowlists, category rules, velocity limits.",
    tone: "cyan" as const,
  },
  {
    icon: GitBranch,
    title: "Agent Process Tree",
    body: "Hierarchical parent-child agent model with cascading revocation. Kill a parent, tear down the entire subtree.",
    tone: "violet" as const,
  },
  {
    icon: ShieldAlert,
    title: "OOB Killer",
    body: "Out-of-Budget Killer. When wallet hits critical threshold, non-essential child agents are forcibly terminated to protect the root.",
    tone: "red" as const,
  },
  {
    icon: Recycle,
    title: "Capital Reclamation (GC)",
    body: "Detect zombie agents, revoke access, release held funds back to the wallet. Prevent budget leaks automatically.",
    tone: "green" as const,
  },
  {
    icon: Gauge,
    title: "Single-Use Tokens",
    body: "30-second TTL payment tokens. Replay-attack proof. Agent never touches money directly — only receives spend authorization.",
    tone: "amber" as const,
  },
  {
    icon: Eye,
    title: "Real-Time Command Center",
    body: "Live transaction feed, burn-rate meters, agent status panels, OOB/GC widgets. Full visibility into fleet operations.",
    tone: "cyan" as const,
  },
];

const flowSteps = [
  { num: "1", label: "Human funds wallet", sub: "via Mollie / iDEAL / SEPA", icon: Wallet },
  { num: "2", label: "Register agents", sub: "Set identity + spend policy", icon: Bot },
  { num: "3", label: "Agent hits paywall", sub: "HTTP 402 response", icon: Zap },
  { num: "4", label: "Policy engine evaluates", sub: "Limits, rules, balance check", icon: ShieldCheck },
  { num: "5", label: "Token issued", sub: "30s single-use credential", icon: CheckCircle },
  { num: "6", label: "Payment settled", sub: "Append-only ledger entry", icon: ReceiptText },
];

const dashboardCapabilities = [
  { icon: Activity, label: "Live transaction feed" },
  { icon: Bot, label: "Agent fleet management" },
  { icon: Wallet, label: "Multi-wallet operations" },
  { icon: ShieldAlert, label: "OOB Killer controls" },
  { icon: TrendingDown, label: "Budget forecasting" },
  { icon: CheckCircle, label: "Approval queue" },
  { icon: Bell, label: "Webhook alerts" },
  { icon: Recycle, label: "GC monitoring" },
];

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
                <Link to="/login" className="btn-ghost text-sm">
                  Sign in
                </Link>
                <Link to="/register" className="btn-primary text-sm">
                  Get started
                </Link>
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
              "radial-gradient(50rem 50rem at 50% 0%, rgba(34,211,238,0.12), transparent 60%), radial-gradient(40rem 40rem at 80% 40%, rgba(139,92,246,0.1), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-20 sm:px-6 sm:pt-28">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-flux-cyan">
            Agentic Commerce Gateway
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl lg:text-6xl">
            The financial OS{" "}
            <span className="bg-gradient-to-r from-flux-cyan to-flux-violet bg-clip-text text-transparent">
              for AI agents
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-muted sm:text-xl">
            Give your agents purchasing power. Keep the kill switch.
            FLUXXX sits between AI agents and the open economy — issuing
            identities, enforcing spend policy, and settling micro-transactions
            over HTTP&nbsp;402.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {user ? (
              <Link to="/dashboard" className="btn-primary">
                Open Command Center <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn-primary">
                  Start building <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/login" className="btn-ghost">
                  Sign in
                </Link>
              </>
            )}
          </div>

          {/* Stat pills */}
          <div className="mt-12 flex flex-wrap gap-3">
            {[
              "HTTP 402 native",
              "Append-only ledger",
              "EU payment rails",
              "OS-inspired governance",
            ].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-line bg-bg-raised/60 px-3.5 py-1.5 text-xs font-medium text-ink-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-flux-cyan">
            How it works
          </p>
          <h2 className="mt-3 text-2xl font-bold text-ink sm:text-3xl">
            From wallet to settlement in milliseconds
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {flowSteps.map(({ num, label, sub, icon: Icon }) => (
              <div
                key={num}
                className="group relative rounded-xl border border-line bg-bg-soft/80 p-5 transition hover:border-flux-cyan/40"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-flux-cyan/20 to-flux-violet/20 text-sm font-bold text-flux-cyan">
                    {num}
                  </span>
                  <Icon className="h-4 w-4 text-ink-faint" />
                </div>
                <p className="text-sm font-semibold text-ink">{label}</p>
                <p className="mt-1 text-sm text-ink-muted">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core features */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-flux-violet">
            Core innovations
          </p>
          <h2 className="mt-3 text-2xl font-bold text-ink sm:text-3xl">
            OS-inspired agent governance
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-ink-muted">
            Inspired by Linux process management. Hierarchical identity,
            cascading revocation, budget protection, and automatic resource
            reclamation — applied to autonomous economic agents.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, body, tone }) => {
              const toneColor = {
                cyan: "text-flux-cyan border-flux-cyan/20 bg-flux-cyan/10",
                violet: "text-flux-violet border-flux-violet/20 bg-flux-violet/10",
                red: "text-flux-red border-flux-red/20 bg-flux-red/10",
                green: "text-flux-green border-flux-green/20 bg-flux-green/10",
                amber: "text-flux-amber border-flux-amber/20 bg-flux-amber/10",
              }[tone];
              const iconColor = {
                cyan: "text-flux-cyan",
                violet: "text-flux-violet",
                red: "text-flux-red",
                green: "text-flux-green",
                amber: "text-flux-amber",
              }[tone];

              return (
                <div
                  key={title}
                  className="rounded-xl border border-line bg-bg-soft/80 p-5 transition hover:border-flux-cyan/30"
                >
                  <div
                    className={`mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg border ${toneColor}`}
                  >
                    <Icon className={`h-[18px] w-[18px] ${iconColor}`} />
                  </div>
                  <p className="text-sm font-semibold text-ink">{title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Command Center preview */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="lg:grid lg:grid-cols-2 lg:gap-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-flux-green">
                Command Center
              </p>
              <h2 className="mt-3 text-2xl font-bold text-ink sm:text-3xl">
                Everything you need. One dashboard.
              </h2>
              <p className="mt-3 text-sm text-ink-muted">
                Real-time visibility into what your agents are spending, where,
                and why. Manage wallets, govern agent fleets, monitor
                compliance, and respond to incidents — all from a single pane of
                glass.
              </p>
              <div className="mt-6">
                {user ? (
                  <Link to="/dashboard" className="btn-primary text-sm">
                    Open dashboard <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <Link to="/login" className="btn-primary text-sm">
                    Try it now <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3 lg:mt-0">
              {dashboardCapabilities.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-lg border border-line bg-bg-soft/80 px-4 py-3 transition hover:border-flux-cyan/30"
                >
                  <Icon className="h-4 w-4 shrink-0 text-flux-cyan" />
                  <span className="text-sm text-ink">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="relative overflow-hidden rounded-2xl border border-line bg-bg-soft/80 p-8 sm:p-12">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(30rem 30rem at 100% 100%, rgba(139,92,246,0.12), transparent 60%), radial-gradient(30rem 30rem at 0% 0%, rgba(34,211,238,0.1), transparent 60%)",
              }}
            />
            <div className="relative text-center">
              <h2 className="text-2xl font-bold text-ink sm:text-3xl">
                Ready to govern your agent fleet?
              </h2>
              <p className="mt-3 text-sm text-ink-muted">
                Set up your first wallet, register an agent, and watch the
                transactions stream in — all in under two minutes.
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
                    <Link to="/login" className="btn-ghost">
                      Sign in
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <LogoMark className="h-5 w-5" />
              <span className="text-sm font-semibold text-ink-muted">FLUXXX</span>
            </div>
            <p className="text-xs text-ink-faint">
              Agentic Commerce Gateway. Built for the autonomous economy.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
