import { Link } from "react-router-dom";
import { Bot, Plus } from "lucide-react";
import type { AgentAnalytics } from "@/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar, meterTone } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn, formatCents, pct, relativeTime } from "@/lib/utils";

export function AgentStatusPanel({ agents }: { agents: AgentAnalytics[] }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title={`Agents (${agents.length})`}
        right={
          <Link to="/agents/new" className="btn-ghost !px-2.5 !py-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> New
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-3">
        {agents.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="No agents yet"
            description="Register an agent to give it a wallet-backed identity."
          />
        ) : (
          <ul className="space-y-2">
            {agents.map((a) => (
              <AgentRow key={a.agent_id} agent={a} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function AgentRow({ agent }: { agent: AgentAnalytics }) {
  const hourlyPct = pct(agent.spent_last_hour_cents, agent.hourly_limit_cents);
  const active = agent.status === "active";
  const dot =
    agent.status === "active"
      ? "bg-flux-green"
      : agent.status === "suspended"
        ? "bg-flux-amber"
        : "bg-flux-red";

  return (
    <li>
      <Link
        to={`/agents/${agent.agent_id}`}
        className="block rounded-lg border border-line bg-bg-raised/30 p-3 transition hover:border-flux-cyan/40 hover:bg-bg-raised/60"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", dot)} />
            <span className="truncate text-sm font-medium text-ink">
              {agent.name}
            </span>
          </span>
          {!active && (
            <span className="shrink-0 text-xs capitalize text-ink-muted">
              {agent.status}
            </span>
          )}
        </div>

        {active ? (
          <div className="mt-2.5">
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span>Hourly burn</span>
              <span className="font-mono">
                {formatCents(agent.spent_last_hour_cents)} /{" "}
                {formatCents(agent.hourly_limit_cents)}
              </span>
            </div>
            <ProgressBar
              percent={hourlyPct}
              tone={meterTone(hourlyPct)}
              className="mt-1.5"
            />
            <p className="mt-1.5 text-xs text-ink-faint">
              Spent today: {formatCents(agent.spent_today_cents)}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-xs text-ink-faint">
            Last seen: {relativeTime(agent.last_seen_at)}
          </p>
        )}
      </Link>
    </li>
  );
}
