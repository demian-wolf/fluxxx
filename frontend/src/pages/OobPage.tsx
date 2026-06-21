import { useCallback, useState } from "react";
import {
  AlertTriangle,
  ShieldAlert,
  Bot,
  Clock,
  Zap,
  Ban,
  ShieldCheck,
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
import { formatCents, relativeTime, formatDateTime } from "@/lib/utils";
import type { OobKillEvent } from "@/types";

export function OobPage() {
  const [simulating, setSimulating] = useState(false);

  const status = useAsync(() => api.getOobStatus(), []);
  const events = useAsync(() => api.listOobEvents(), []);
  const wallets = useAsync(() => api.listWallets(), []);

  const refreshAll = useCallback(() => {
    status.refresh();
    events.refresh();
  }, [status, events]);

  useRefreshOnFocus(refreshAll);

  const handleSimulate = async () => {
    if (!wallets.data?.length) return;
    setSimulating(true);
    try {
      // Simulate OOB kill on the first wallet with a high threshold to demonstrate
      await api.simulateOobKill(wallets.data[0].id, wallets.data[0].balance_cents + 100);
      refreshAll();
    } finally {
      setSimulating(false);
    }
  };

  if (status.loading && !status.data) {
    return <LoadingState label="Loading OOB Killer status..." />;
  }

  const s = status.data;

  return (
    <>
      <PageHeader
        title="OOB Killer"
        subtitle="Out-of-Budget Killer — emergency termination of rogue child agents when wallets approach depletion (€5 threshold)."
        actions={
          <button
            onClick={handleSimulate}
            disabled={simulating}
            className="btn-primary"
          >
            <Zap className="h-4 w-4" />
            {simulating ? "Simulating..." : "Simulate Kill"}
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Kill Events"
          value={s?.total_events ?? 0}
          icon={AlertTriangle}
          tone="red"
          hint="Times the OOB Killer has activated"
        />
        <StatCard
          label="Agents Terminated"
          value={s?.total_agents_killed ?? 0}
          icon={Bot}
          tone="amber"
          hint="Non-essential child agents force-revoked"
        />
        <StatCard
          label="Tokens Invalidated"
          value={s?.total_tokens_invalidated ?? 0}
          icon={Ban}
          tone="violet"
          hint="Spend tokens forcibly cancelled"
        />
        <StatCard
          label="Last Triggered"
          value={s?.last_triggered_at ? relativeTime(s.last_triggered_at) : "never"}
          icon={Clock}
          tone="cyan"
          hint={
            s?.last_triggered_at
              ? formatDateTime(s.last_triggered_at)
              : "OOB Killer has not activated yet"
          }
        />
      </div>

      <Card>
        <CardHeader
          title="Kill Events"
          subtitle="Emergency terminations triggered when wallet balance hit the €5 threshold"
        />
        <div className="p-0">
          {events.loading && !events.data ? (
            <div className="p-6">
              <LoadingState label="Loading events..." />
            </div>
          ) : !events.data?.length ? (
            <div className="p-6">
              <EmptyState
                icon={ShieldCheck}
                title="No OOB kills triggered"
                description="All wallets are above the critical €5 threshold. The OOB Killer activates automatically when a swarm drains a wallet to its emergency reserve."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                    <th className="px-4 py-3">Protected Root</th>
                    <th className="px-4 py-3">Agents Killed</th>
                    <th className="px-4 py-3 text-right">Balance at Trigger</th>
                    <th className="px-4 py-3 text-right">Tokens Revoked</th>
                    <th className="px-4 py-3 text-right">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {events.data.map((event) => (
                    <OobEventRow key={event.id} event={event} />
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

function OobEventRow({ event }: { event: OobKillEvent }) {
  return (
    <tr className="transition hover:bg-bg-raised/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-flux-red" />
          <span className="font-medium text-ink">
            {event.protected_agent_name ?? "Unknown Root"}
          </span>
        </div>
        <p className="mt-0.5 pl-6 text-xs text-ink-faint">
          Wallet: {event.wallet_id.slice(0, 12)}...
        </p>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {event.killed_agent_names.map((name, i) => (
            <Badge key={i} tone="red">
              {name}
            </Badge>
          ))}
          {event.killed_agent_names.length === 0 && (
            <span className="text-ink-faint">-</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right font-mono text-ink">
        <span className="text-flux-red">
          {formatCents(event.trigger_balance_cents)}
        </span>
        <span className="ml-1 text-xs text-ink-faint">
          / {formatCents(event.threshold_cents)}
        </span>
      </td>
      <td className="px-4 py-3 text-right font-mono text-ink">
        {event.tokens_invalidated > 0 ? (
          <span className="text-flux-amber">{event.tokens_invalidated}</span>
        ) : (
          <span className="text-ink-faint">0</span>
        )}
      </td>
      <td className="px-4 py-3 text-right text-xs text-ink-muted">
        {relativeTime(event.created_at)}
      </td>
    </tr>
  );
}
