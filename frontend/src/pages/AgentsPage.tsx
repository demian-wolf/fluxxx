import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bot, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { api } from "@/api";
import { useToast } from "@/context/ToastContext";
import { useAsync } from "@/hooks/useAsync";
import { useLiveLedger } from "@/hooks/useLiveLedger";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AgentStatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState, ErrorState } from "@/components/ui/Spinner";
import { cn, formatCents, pct, relativeTime } from "@/lib/utils";
import { ProgressBar, meterTone } from "@/components/ui/ProgressBar";
import { buildAgentForest, flattenForest } from "@/lib/agentTree";
import type { AgentIdentity } from "@/types";

export function AgentsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const agents = useAsync(() => api.listAgents(), []);
  const wallets = useAsync(() => api.listWallets(), []);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

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

  const walletName = (wid: string) =>
    wallets.data?.find((w) => w.id === wid)?.name ?? "—";
  const findAnalytics = (aid: string) =>
    analytics.data?.find((a) => a.agent_id === aid);

  // Agents form a process tree (parent → child sub-agents); render it as nested
  // rows instead of a flat list.
  const forest = useMemo(
    () => buildAgentForest(agents.data ?? []),
    [agents.data],
  );
  const visible = useMemo(
    () => flattenForest(forest, collapsed),
    [forest, collapsed],
  );

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const quickAction = async (
    e: React.MouseEvent,
    agent: AgentIdentity,
    status: AgentIdentity["status"],
  ) => {
    e.stopPropagation();
    try {
      await api.setAgentStatus(agent.id, status);
      const verb = status === "active" ? "reactivated" : status;
      toast("success", `Agent ${verb}`, agent.name);
      agents.refresh();
    } catch {
      toast("error", "Action failed");
    }
  };

  return (
    <>
      <PageHeader
        title="Agents"
        subtitle="Every registered AI agent, organised as a spend tree of parent and child sub-agents."
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
        ) : visible.length === 0 ? (
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
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line">
                  {["Agent", "Wallet", "Status", "Hourly burn", "Spent today", "Last seen", ""].map(
                    (h, i) => (
                      <th
                        key={h || `col-${i}`}
                        className={cn(
                          "whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted",
                          (h === "Spent today" || h === "") && "text-right",
                        )}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((node) => {
                  const agent = node.agent;
                  const an = findAnalytics(agent.id);
                  const hasChildren = node.children.length > 0;
                  const isCollapsed = collapsed.has(agent.id);
                  const spent = an?.spent_last_hour_cents ?? 0;
                  const p = pct(spent, agent.hourly_limit_cents);
                  return (
                    <tr
                      key={agent.id}
                      onClick={() => navigate(`/agents/${agent.id}`)}
                      className="cursor-pointer border-b border-line/60 transition hover:bg-bg-raised/50"
                    >
                      <td className="px-4 py-3">
                        <div
                          className="flex items-center gap-1.5"
                          style={{ paddingLeft: `${node.depth * 1.5}rem` }}
                        >
                          {hasChildren ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggle(agent.id);
                              }}
                              className="rounded p-0.5 text-ink-faint hover:bg-bg-raised hover:text-ink"
                              aria-label={isCollapsed ? "Expand" : "Collapse"}
                            >
                              {isCollapsed ? (
                                <ChevronRight className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          ) : (
                            <span className="inline-block w-5" />
                          )}
                          <div>
                            <p className="flex items-center gap-2 font-medium text-ink">
                              {agent.name}
                              {hasChildren && (
                                <span className="rounded-full bg-bg-raised px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
                                  {node.children.length} sub
                                </span>
                              )}
                            </p>
                            <p className="font-mono text-xs text-ink-faint">
                              ••••{agent.api_key_preview}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-ink-muted">{walletName(agent.wallet_id)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <AgentStatusBadge status={agent.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-36">
                          <div className="flex justify-between text-xs text-ink-muted">
                            <span className="font-mono">
                              {formatCents(spent)}/{formatCents(agent.hourly_limit_cents)}
                            </span>
                            <span>{p}%</span>
                          </div>
                          <ProgressBar percent={p} tone={meterTone(p)} className="mt-1" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-ink">
                          {formatCents(an?.spent_today_cents ?? 0)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-ink-muted">{relativeTime(agent.last_seen_at)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
