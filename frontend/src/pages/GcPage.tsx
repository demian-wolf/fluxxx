import { useCallback, useState } from "react";
import {
  Recycle,
  Skull,
  Clock,
  ArrowUpRight,
  Zap,
  TrendingUp,
} from "lucide-react";
import { api } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useRefreshOnFocus } from "@/hooks/useInterval";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/Spinner";
import { formatCents, relativeTime, formatDateTime, cn } from "@/lib/utils";
import type { GcEvent, GcReason } from "@/types";

const reasonLabels: Record<GcReason, string> = {
  ttl_expired: "TTL Expired",
  agent_revoked: "Agent Revoked",
  agent_suspended: "Agent Suspended",
  parent_terminated: "Parent Terminated",
};

const reasonTone: Record<GcReason, "red" | "amber" | "violet" | "neutral"> = {
  ttl_expired: "amber",
  agent_revoked: "red",
  agent_suspended: "amber",
  parent_terminated: "violet",
};

export function GcPage() {
  const [sweeping, setSweeping] = useState(false);

  const status = useAsync(() => api.getGcStatus(), []);
  const events = useAsync(() => api.listGcEvents(), []);

  const refreshAll = useCallback(() => {
    status.refresh();
    events.refresh();
  }, [status, events]);

  useRefreshOnFocus(refreshAll);

  const handleSweep = async () => {
    setSweeping(true);
    try {
      await api.triggerSweep();
      refreshAll();
    } finally {
      setSweeping(false);
    }
  };

  if (status.loading && !status.data) {
    return <LoadingState label="Loading capital reclamation status..." />;
  }

  const s = status.data;

  return (
    <>
      <PageHeader
        title="Capital Reclamation"
        subtitle="Agentic Garbage Collection — detect zombie agents and reclaim stranded capital."
        actions={
          <button
            onClick={handleSweep}
            disabled={sweeping}
            className="btn-primary"
          >
            <Zap className="h-4 w-4" />
            {sweeping ? "Sweeping..." : "Run Sweep"}
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Reclamations"
          value={s?.total_events ?? 0}
          icon={Recycle}
          tone="cyan"
          hint="Zombie agents detected and reclaimed"
        />
        <StatCard
          label="Funds Reclaimed"
          value={formatCents(s?.total_reclaimed_cents ?? 0)}
          icon={TrendingUp}
          tone="green"
          hint="Held funds swept back to wallets"
        />
        <StatCard
          label="Budget Capacity Freed"
          value={formatCents(s?.total_limit_freed ?? 0)}
          icon={ArrowUpRight}
          tone="violet"
          hint="Daily limit freed for reallocation"
        />
        <StatCard
          label="Last Sweep"
          value={s?.last_sweep_at ? relativeTime(s.last_sweep_at) : "never"}
          icon={Clock}
          tone="amber"
          hint={
            s?.last_sweep_at
              ? formatDateTime(s.last_sweep_at)
              : "No sweep has run yet"
          }
        />
      </div>

      <Card>
        <CardHeader
          title="Reclamation Events"
          subtitle="History of zombie agents detected and capital reclaimed"
        />
        <div className="p-0">
          {events.loading && !events.data ? (
            <div className="p-6">
              <LoadingState label="Loading events..." />
            </div>
          ) : !events.data?.length ? (
            <div className="p-6">
              <EmptyState
                icon={Skull}
                title="No zombie agents found"
                description="All agents are healthy. The GC sweep runs automatically in the background, or you can trigger a manual sweep above."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3 text-right">Funds Reclaimed</th>
                    <th className="px-4 py-3 text-right">Budget Freed</th>
                    <th className="px-4 py-3 text-right">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {events.data.map((event) => (
                    <GcEventRow key={event.id} event={event} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

function GcEventRow({ event }: { event: GcEvent }) {
  return (
    <tr className="transition hover:bg-bg-raised/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Skull
            className={cn(
              "h-4 w-4 shrink-0",
              event.reason === "agent_revoked"
                ? "text-flux-red"
                : event.reason === "ttl_expired"
                  ? "text-flux-amber"
                  : "text-flux-violet",
            )}
          />
          <span className="font-medium text-ink">{event.agent_name}</span>
        </div>
        {event.parent_agent_id && (
          <p className="mt-0.5 pl-6 text-xs text-ink-faint">
            child of {event.parent_agent_id.slice(0, 8)}...
          </p>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge tone={reasonTone[event.reason]}>
          {reasonLabels[event.reason]}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right font-mono text-ink">
        {event.reclaimed_cents > 0 ? (
          <span className="text-flux-green">
            +{formatCents(event.reclaimed_cents)}
          </span>
        ) : (
          <span className="text-ink-faint">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-right font-mono text-ink">
        {formatCents(event.daily_limit_freed)}
      </td>
      <td className="px-4 py-3 text-right text-xs text-ink-muted">
        {relativeTime(event.created_at)}
      </td>
    </tr>
  );
}
