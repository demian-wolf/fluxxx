import type { ReactNode } from "react";
import { Wordmark } from "@/components/Logo";
import { ShieldCheck, Activity, Gauge } from "lucide-react";

const highlights = [
  {
    icon: ShieldCheck,
    title: "Know Your Agent",
    body: "Every agent gets a verifiable identity and a human-governed spend policy.",
  },
  {
    icon: Gauge,
    title: "Hard spend limits",
    body: "Per-transaction, hourly and daily caps enforced atomically before any spend.",
  },
  {
    icon: Activity,
    title: "Live ledger",
    body: "Watch every 402 → approval cycle stream in real time across your fleet.",
  },
];

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <Wordmark />
          </div>
          {children}
        </div>
      </div>
      <div className="relative hidden overflow-hidden border-l border-line bg-bg-soft/50 lg:flex lg:flex-col lg:justify-center lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(40rem 40rem at 80% 20%, rgba(139,92,246,0.12), transparent 60%), radial-gradient(40rem 40rem at 20% 80%, rgba(34,211,238,0.12), transparent 60%)",
          }}
        />
        <div className="relative max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-flux-cyan">
            Agentic Commerce Gateway
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-tight text-ink">
            The command center for AI agent spend.
          </h2>
          <p className="mt-3 text-sm text-ink-muted">
            FLUX sits between your agents and the open economy — issuing
            identities, enforcing policy, and settling micro-transactions over
            HTTP 402.
          </p>
          <div className="mt-8 space-y-4">
            {highlights.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-bg-raised/60">
                  <Icon className="h-[18px] w-[18px] text-flux-cyan" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">{title}</p>
                  <p className="text-sm text-ink-muted">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
