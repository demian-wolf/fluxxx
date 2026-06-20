import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bot, Plus } from "lucide-react";
import { api } from "@/api";
import { useToast } from "@/context/ToastContext";
import { useAsync } from "@/hooks/useAsync";
import { useLiveLedger } from "@/hooks/useLiveLedger";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AgentStatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState, ErrorState } from "@/components/ui/Spinner";
import { formatCents, pct, relativeTime } from "@/lib/utils";
import { ProgressBar, meterTone } from "@/components/ui/ProgressBar";
import type { AgentAnalytics, AgentIdentity } from "@/types";

interface Row {
  agent: AgentIdentity;
  walletName: string;
  analytics?: AgentAnalytics;
}

export function AgentsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const agents = useAsync(() => api.listAgents(), []);
  const wallets = useAsync(() => api.listWallets(), []);

  // analytics are derived per wallet; pull all wallets' analytics together
  const analytics = useAsync(async () => {
    const ws = await api.listWallets();
    const all = await Promise.all(ws.map((w) => api.getWalletAnalytics(w.id)));
    return all.flatMap((a) => a.agents);
  }, []);

  useLiveLedger(() => {
    agents.refresh();
    analytics.refresh();
  });

  const rows = useMemo<Row[]>(() => {
    const walletName = (wid: string) =>
      wallets.data?.find((w) => w.id === wid)?.name ?? "—";
    const findAnalytics = (aid: string) =>
      analytics.data?.find((a) => a.agent_id === aid);
    return (agents.data ?? []).map((agent) => ({
      agent,
      walletName: walletName(agent.wallet_id),
      analytics: findAnalytics(agent.id),
    }));
  }, [agents.data, wallets.data, analytics.data]);

  const quickAction = async (
    e: React.MouseEvent,
    agent: AgentIdentity,
    status: AgentIdentity["status"],
  ) => {
    e.stopPropagation();
    try {
      await api.setAgentStatus(agent.id, status);
      toast("success", `Agent ${status}`, agent.name);
      agents.refresh();
    } catch {
      toast("error", "Action failed");
    }
  };

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Name",
      render: ({ agent }) => (
        <div>
          <p className="font-medium text-ink">{agent.name}</p>
          <p className="font-mono text-xs text-ink-faint">
            ••••{agent.api_key_preview}
          </p>
        </div>
      ),
    },
    {
      key: "wallet",
      header: "Wallet",
      render: ({ walletName }) => (
        <span className="text-ink-muted">{walletName}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: ({ agent }) => <AgentStatusBadge status={agent.status} />,
    },
    {
      key: "hourly",
      header: "Hourly burn",
      render: ({ agent, analytics: an }) => {
        const spent = an?.spent_last_hour_cents ?? 0;
        const p = pct(spent, agent.hourly_limit_cents);
        return (
          <div className="w-36">
            <div className="flex justify-between text-xs text-ink-muted">
              <span className="font-mono">
                {formatCents(spent)}/{formatCents(agent.hourly_limit_cents)}
              </span>
              <span>{p}%</span>
            </div>
            <ProgressBar percent={p} tone={meterTone(p)} className="mt-1" />
          </div>
        );
      },
    },
    {
      key: "today",
      header: "Spent today",
      align: "right",
      render: ({ analytics: an }) => (
        <span className="font-mono text-ink">
          {formatCents(an?.spent_today_cents ?? 0)}
        </span>
      ),
    },
    {
      key: "seen",
      header: "Last seen",
      render: ({ agent }) => (
        <span className="text-ink-muted">{relativeTime(agent.last_seen_at)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: ({ agent }) => (
        <div className="flex justify-end gap-2">
          {agent.status === "active" ? (
            <button
              onClick={(e) => quickAction(e, agent, "suspended")}
              className="text-xs font-medium text-flux-amber hover:underline"
            >
              Suspend
            </button>
          ) : agent.status === "suspended" ? (
            <button
              onClick={(e) => quickAction(e, agent, "active")}
              className="text-xs font-medium text-flux-green hover:underline"
            >
              Reactivate
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Agents"
        subtitle="Every registered AI agent across all wallets."
        actions={
          <Button onClick={() => navigate("/agents/new")}>
            <Plus className="h-4 w-4" /> Register New Agent
          </Button>
        }
      />

      <Card>
        {agents.loading ? (
          <LoadingState />
        ) : agents.error ? (
          <ErrorState message={agents.error} onRetry={agents.refresh} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="No agents registered"
            description="Register an agent to give it a verifiable identity and spend policy."
            action={
              <Link to="/agents/new" className="btn-primary mt-1">
                <Plus className="h-4 w-4" /> Register New Agent
              </Link>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={({ agent }) => agent.id}
            onRowClick={({ agent }) => navigate(`/agents/${agent.id}`)}
          />
        )}
      </Card>
    </>
  );
}
