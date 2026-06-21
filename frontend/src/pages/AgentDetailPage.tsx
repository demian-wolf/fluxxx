import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Ban, GitBranch, Pause, Play, Pencil, Plus, Zap } from "lucide-react";
import { api } from "@/api";
import { useToast } from "@/context/ToastContext";
import { useAsync } from "@/hooks/useAsync";
import { useLiveLedger } from "@/hooks/useLiveLedger";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { AgentStatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar, meterTone } from "@/components/ui/ProgressBar";
import { LoadingState, ErrorState } from "@/components/ui/Spinner";
import { SpendLineChart } from "@/components/charts/SpendLineChart";
import { TransactionTable } from "@/components/domain/TransactionTable";
import { formatCents, formatDateTime, pct, relativeTime } from "@/lib/utils";
import type { AgentIdentity, SpawnAgentInput } from "@/types";

export function AgentDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tab, setTab] = useState("overview");
  const [busy, setBusy] = useState(false);
  const [showSpawn, setShowSpawn] = useState(false);
  const [spawnBusy, setSpawnBusy] = useState(false);
  const [spawnResult, setSpawnResult] = useState<{ api_key: string; agent_id: string } | null>(null);

  const agent = useAsync(() => api.getAgent(id), [id]);
  const analytics = useAsync(() => api.getAgentAnalytics(id), [id]);
  const series = useAsync(() => api.getAgentSpendSeries(id), [id]);
  const txns = useAsync(() => api.listTransactions({ agentIds: [id] }), [id]);
  const policies = useAsync(() => api.listPolicies(id), [id]);
  const wallets = useAsync(() => api.listWallets(), []);
  const allAgents = useAsync(() => api.listAgents(), []);

  const refreshLive = useCallback(() => {
    agent.refresh();
    analytics.refresh();
    series.refresh();
    txns.refresh();
    allAgents.refresh();
  }, [agent, analytics, series, txns, allAgents]);
  useLiveLedger(refreshLive);

  const walletName = useMemo(
    () =>
      wallets.data?.find((w) => w.id === agent.data?.wallet_id)?.name ?? "—",
    [wallets.data, agent.data],
  );

  const parent = useMemo(
    () =>
      agent.data?.parent_id
        ? allAgents.data?.find((x) => x.id === agent.data?.parent_id) ?? null
        : null,
    [allAgents.data, agent.data],
  );
  const children = useMemo(
    () => (allAgents.data ?? []).filter((x) => x.parent_id === id),
    [allAgents.data, id],
  );

  if (agent.loading) return <LoadingState />;
  if (agent.error || !agent.data)
    return <ErrorState message={agent.error ?? "not found"} onRetry={agent.refresh} />;

  const a = agent.data;
  const hourlySpent = analytics.data?.spent_last_hour_cents ?? 0;
  const dailySpent = analytics.data?.spent_today_cents ?? 0;
  const hourlyPct = pct(hourlySpent, a.hourly_limit_cents);
  const dailyPct = pct(dailySpent, a.daily_limit_cents);

  const setStatus = async (status: typeof a.status) => {
    setBusy(true);
    try {
      await api.setAgentStatus(id, status);
      toast("success", `Agent ${status}`, a.name);
      refreshLive();
    } catch {
      toast("error", "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title={a.name}
        crumbs={[{ label: "Agents", to: "/agents" }, { label: a.name }]}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <AgentStatusBadge status={a.status} />
            <span className="text-xs text-ink-muted">
              Wallet: <span className="text-ink">{walletName}</span>
            </span>
            <span className="text-xs text-ink-muted">
              Parent:{" "}
              {parent ? (
                <Link to={`/agents/${parent.id}`} className="text-flux-cyan hover:underline">
                  {parent.name}
                </Link>
              ) : (
                <span className="text-ink">root agent</span>
              )}
            </span>
            <span className="text-xs text-ink-muted">
              Last seen:{" "}
              <span className="text-ink">{relativeTime(a.last_seen_at)}</span>
            </span>
            <span className="font-mono text-xs text-ink-faint">
              API key ••••{a.api_key_preview}
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate(`/agents/${id}/policy`)}>
              <Pencil className="h-4 w-4" /> Edit Policy
            </Button>
            {a.status === "active" ? (
              <Button variant="ghost" onClick={() => setStatus("suspended")} loading={busy}>
                <Pause className="h-4 w-4" /> Suspend
              </Button>
            ) : a.status === "suspended" ? (
              <Button variant="ghost" onClick={() => setStatus("active")} loading={busy}>
                <Play className="h-4 w-4" /> Reactivate
              </Button>
            ) : null}
            {a.status !== "revoked" && (
              <Button variant="danger" onClick={() => setStatus("revoked")} loading={busy}>
                <Ban className="h-4 w-4" /> Revoke
              </Button>
            )}
          </>
        }
      />

      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "transactions", label: "Transactions" },
          { id: "policy", label: "Policy History" },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-4"
      />

      {tab === "overview" && (
        <div className="space-y-4">
          <Card>
            <CardHeader title="Live spend meters" />
            <CardBody className="space-y-5">
              <Meter
                label="Hourly burn rate"
                spent={hourlySpent}
                limit={a.hourly_limit_cents}
                percent={hourlyPct}
              />
              <Meter
                label="Daily spend"
                spent={dailySpent}
                limit={a.daily_limit_cents}
                percent={dailyPct}
              />
              <div className="flex items-center justify-between rounded-lg border border-line bg-bg-raised/30 px-4 py-3">
                <span className="text-sm text-ink-muted">Per transaction cap</span>
                <span className="font-mono text-sm text-ink">
                  {formatCents(a.per_tx_limit_cents)} max
                </span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Spend over last 24 hours" />
            <CardBody>
              {series.loading ? (
                <LoadingState />
              ) : (
                <SpendLineChart
                  data={series.data ?? []}
                  limitCents={a.hourly_limit_cents}
                  height={220}
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Sub-agents"
              subtitle="Child agents spawned under this one. Suspending or revoking this agent cascades to all of them."
              right={
                <span className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    className="!px-2.5 !py-1.5 text-xs"
                    onClick={() => setShowSpawn(true)}
                  >
                    <Zap className="h-3.5 w-3.5" /> Spawn
                  </Button>
                  <Button
                    variant="ghost"
                    className="!px-2.5 !py-1.5 text-xs"
                    onClick={() => navigate(`/agents/new?wallet=${a.wallet_id}&parent=${a.id}`)}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add sub-agent
                  </Button>
                </span>
              }
            />
            <CardBody>
              {showSpawn && (
                <SpawnForm
                  parent={a}
                  siblings={children}
                  busy={spawnBusy}
                  result={spawnResult}
                  onSpawn={async (input) => {
                    setSpawnBusy(true);
                    try {
                      const res = await api.spawnAgent(a.id, input);
                      setSpawnResult({ api_key: res.api_key, agent_id: res.agent_id });
                      toast("success", "Sub-agent spawned", input.name);
                      refreshLive();
                    } catch (e) {
                      toast("error", `Spawn failed: ${(e as Error).message}`);
                    } finally {
                      setSpawnBusy(false);
                    }
                  }}
                  onClose={() => {
                    setShowSpawn(false);
                    setSpawnResult(null);
                  }}
                />
              )}
              {children.length === 0 && !showSpawn ? (
                <p className="py-4 text-center text-sm text-ink-muted">
                  No sub-agents. This is a leaf in the spend tree.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {children.map((c) => (
                    <li key={c.id}>
                      <Link
                        to={`/agents/${c.id}`}
                        className="flex items-center justify-between gap-3 px-1 py-3 transition hover:text-flux-cyan"
                      >
                        <span className="flex items-center gap-2 text-sm font-medium text-ink">
                          <GitBranch className="h-4 w-4 text-ink-faint" />
                          {c.name}
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="font-mono text-xs text-ink-faint">
                            {formatCents(c.daily_limit_cents)}/day
                          </span>
                          <AgentStatusBadge status={c.status} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {tab === "transactions" && (
        <Card>
          {txns.loading ? (
            <LoadingState />
          ) : (
            <TransactionTable rows={txns.data ?? []} showAgent={false} />
          )}
        </Card>
      )}

      {tab === "policy" && (
        <Card>
          <CardHeader title="Policy version history" subtitle="Previous versions are archived, never deleted." />
          {policies.loading ? (
            <LoadingState />
          ) : (
            <ul className="divide-y divide-line">
              {(policies.data ?? []).map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium text-ink">
                      Policy v{p.version}
                      {p.is_active && (
                        <span className="rounded-full bg-flux-green/15 px-2 py-0.5 text-xs text-flux-green">
                          active
                        </span>
                      )}
                    </p>
                    <p className="mt-1 font-mono text-xs text-ink-muted">
                      per-tx {formatCents(p.rules.per_tx_limit_cents)} · hourly{" "}
                      {formatCents(p.rules.hourly_limit_cents)} · daily{" "}
                      {formatCents(p.rules.daily_limit_cents)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-faint">
                    {formatDateTime(p.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}

function Meter({
  label,
  spent,
  limit,
  percent,
}: {
  label: string;
  spent: number;
  limit: number;
  percent: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-muted">{label}</span>
        <span className="font-mono text-ink">
          {formatCents(spent)} / {formatCents(limit)}{" "}
          <span className="text-ink-faint">({percent}%)</span>
        </span>
      </div>
      <ProgressBar percent={percent} tone={meterTone(percent)} className="mt-2" />
    </div>
  );
}

function SpawnForm({
  parent,
  siblings,
  busy,
  result,
  onSpawn,
  onClose,
}: {
  parent: AgentIdentity;
  siblings: AgentIdentity[];
  busy: boolean;
  result: { api_key: string; agent_id: string } | null;
  onSpawn: (input: SpawnAgentInput) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [daily, setDaily] = useState("");

  const allocated = siblings.reduce((sum, s) => sum + s.daily_limit_cents, 0);
  const remaining = parent.daily_limit_cents - allocated;

  if (result) {
    return (
      <div className="mb-4 rounded-lg border border-flux-green/30 bg-flux-green/5 p-4">
        <p className="text-sm font-medium text-flux-green">Sub-agent spawned successfully</p>
        <p className="mt-2 text-xs text-ink-muted">
          Agent ID: <span className="font-mono text-ink">{result.agent_id}</span>
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          API Key (shown once):{" "}
          <code className="rounded bg-bg-raised px-1.5 py-0.5 font-mono text-xs text-flux-cyan">
            {result.api_key}
          </code>
        </p>
        <Button variant="ghost" className="mt-3 !px-2.5 !py-1.5 text-xs" onClick={onClose}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-line bg-bg-raised/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-ink">
          <Zap className="mr-1.5 inline h-3.5 w-3.5 text-flux-cyan" />
          Spawn sub-agent (agent-initiated fork)
        </p>
        <button onClick={onClose} className="text-xs text-ink-faint hover:text-ink">
          Cancel
        </button>
      </div>
      <p className="mb-3 text-xs text-ink-muted">
        Budget remaining: <span className="font-mono text-ink">{formatCents(remaining)}/day</span>{" "}
        (parent {formatCents(parent.daily_limit_cents)} \u2212 allocated {formatCents(allocated)})
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="SubWorker"
            className="w-40 rounded border border-line bg-bg-base px-2 py-1.5 font-mono text-sm text-ink placeholder:text-ink-faint focus:border-flux-cyan focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Daily limit (cents)
          <input
            type="number"
            value={daily}
            onChange={(e) => setDaily(e.target.value)}
            placeholder={String(remaining)}
            min={1}
            max={remaining}
            className="w-32 rounded border border-line bg-bg-base px-2 py-1.5 font-mono text-sm text-ink placeholder:text-ink-faint focus:border-flux-cyan focus:outline-none"
          />
        </label>
        <Button
          variant="primary"
          className="!px-3 !py-1.5 text-xs"
          loading={busy}
          disabled={!name.trim() || !daily || Number(daily) <= 0 || Number(daily) > remaining}
          onClick={() => onSpawn({ name: name.trim(), daily_limit_cents: Number(daily) })}
        >
          Spawn
        </Button>
      </div>
    </div>
  );
}
