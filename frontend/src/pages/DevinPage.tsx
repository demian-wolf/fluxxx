import { useCallback, useMemo, useState } from "react";
import {
  Bot,
  ExternalLink,
  Play,
  ReceiptText,
  ShieldAlert,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { api } from "@/api";
import { useToast } from "@/context/ToastContext";
import { useAsync } from "@/hooks/useAsync";
import { useRefreshOnFocus } from "@/hooks/useInterval";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Input";
import { Select, type SelectOption } from "@/components/ui/Select";
import { ErrorState, LoadingState } from "@/components/ui/Spinner";
import { StatCard } from "@/components/ui/StatCard";
import { formatCents, relativeTime } from "@/lib/utils";
import type { DevinSession, DevinSessionStatus, LaunchDevinInput } from "@/types";

const STATUS_TONES: Record<DevinSessionStatus, "green" | "amber" | "cyan" | "red" | "neutral"> = {
  provisioning: "amber",
  running: "green",
  paused: "amber",
  completed: "cyan",
  failed: "red",
};

export function DevinPage() {
  const { toast } = useToast();
  const sessions = useAsync(() => api.listDevinSessions(), []);
  const stats = useAsync(() => api.getDevinSessionStats(), []);
  const wallets = useAsync(() => api.listWallets(), []);
  const [showLaunch, setShowLaunch] = useState(false);

  const refresh = useCallback(() => {
    sessions.refresh();
    stats.refresh();
  }, [sessions, stats]);

  useRefreshOnFocus(refresh);

  const sessionList = useMemo(() => sessions.data ?? [], [sessions.data]);
  const statData = stats.data;

  const handleLaunch = async (input: LaunchDevinInput) => {
    try {
      const session = await api.launchDevinSession(input);
      toast(
        "success",
        "Devin session launched",
        `${session.agent_name} is now running with FLUX governance.`,
      );
      setShowLaunch(false);
      refresh();
    } catch {
      toast("error", "Failed to launch Devin session");
    }
  };

  const handleEscalate = async (
    sessionId: string,
    newLimitCents: number,
    limitField: string,
  ) => {
    try {
      await api.escalateDevinSession(sessionId, newLimitCents, limitField);
      toast("success", "Budget escalated", "Devin can now resume with updated limits.");
      refresh();
    } catch {
      toast("error", "Failed to escalate budget");
    }
  };

  if (sessions.loading && !sessions.data) {
    return <LoadingState label="Loading Devin sessions..." />;
  }

  return (
    <>
      <PageHeader
        title="Devin Integration"
        subtitle="Launch and govern autonomous Devin sessions through FLUX wallets. Every spend is policy-checked in real time."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Sessions"
          value={statData?.total_sessions ?? 0}
          icon={Bot}
          tone="cyan"
          hint="Total governed Devin sessions"
        />
        <StatCard
          label="Active"
          value={statData?.active_sessions ?? 0}
          icon={Zap}
          tone="green"
          hint="Currently running sessions"
        />
        <StatCard
          label="Total Spend"
          value={formatCents(statData?.total_spent_cents ?? 0)}
          icon={Wallet}
          tone="violet"
          hint="Combined spend across all sessions"
        />
        <StatCard
          label="Transactions"
          value={statData?.total_transactions ?? 0}
          icon={ReceiptText}
          tone="amber"
          hint="Approved policy-checked transactions"
        />
        <StatCard
          label="Rejections"
          value={statData?.total_rejections ?? 0}
          icon={ShieldAlert}
          tone="red"
          hint="Policy engine blocked these requests"
        />
      </div>

      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-ink">Governed Sessions</h2>
        <Button onClick={() => setShowLaunch(!showLaunch)}>
          <Play className="h-4 w-4" /> Launch Devin Session
        </Button>
      </div>

      {showLaunch && (
        <LaunchForm
          wallets={wallets.data ?? []}
          onLaunch={handleLaunch}
          onCancel={() => setShowLaunch(false)}
        />
      )}

      {sessions.error ? (
        <Card>
          <ErrorState message={sessions.error} onRetry={sessions.refresh} />
        </Card>
      ) : sessionList.length === 0 ? (
        <Card>
          <EmptyState
            icon={Bot}
            title="No Devin sessions yet"
            description="Launch a governed Devin session to see autonomous AI spend controlled by FLUX policies in real time."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {sessionList.map((session) => (
            <DevinSessionCard
              key={session.id}
              session={session}
              onEscalate={handleEscalate}
            />
          ))}
        </div>
      )}
    </>
  );
}

function LaunchForm({
  wallets,
  onLaunch,
  onCancel,
}: {
  wallets: Array<{ id: string; name: string }>;
  onLaunch: (input: LaunchDevinInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [walletId, setWalletId] = useState("");
  const [task, setTask] = useState("");
  const [agentName, setAgentName] = useState("");
  const [perTx, setPerTx] = useState("0.10");
  const [hourly, setHourly] = useState("2.00");
  const [daily, setDaily] = useState("10.00");
  const [submitting, setSubmitting] = useState(false);

  const valid = walletId && task.trim();

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    try {
      await onLaunch({
        wallet_id: walletId,
        task: task.trim(),
        agent_name: agentName.trim() || undefined,
        per_tx_limit_cents: Math.round(parseFloat(perTx) * 100) || 10,
        hourly_limit_cents: Math.round(parseFloat(hourly) * 100) || 200,
        daily_limit_cents: Math.round(parseFloat(daily) * 100) || 1000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader
        title="Launch Governed Devin Session"
        subtitle="Devin will receive a FLUX AgentIdentity with the spend limits you set. Every resource purchase is policy-checked."
      />
      <CardBody className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Wallet">
            <Select
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
              options={[
                { value: "", label: "Select a wallet..." },
                ...wallets.map((w): SelectOption => ({ value: w.id, label: w.name })),
              ]}
            />
          </Field>
          <Field label="Agent label (optional)">
            <Input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="e.g. Dataset Pipeline"
            />
          </Field>
        </div>

        <Field label="Task description">
          <textarea
            className="w-full rounded-lg border border-line bg-bg-raised px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-flux-cyan focus:outline-none focus:ring-1 focus:ring-flux-cyan"
            rows={3}
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="e.g. Build a data ingestion pipeline that pulls climate data from dataset.io. Purchase any required API keys."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Per-tx limit">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={perTx}
              onChange={(e) => setPerTx(e.target.value)}
              leading="\u20ac"
            />
          </Field>
          <Field label="Hourly limit">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={hourly}
              onChange={(e) => setHourly(e.target.value)}
              leading="\u20ac"
            />
          </Field>
          <Field label="Daily limit">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={daily}
              onChange={(e) => setDaily(e.target.value)}
              leading="\u20ac"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            loading={submitting}
            disabled={!valid || submitting}
          >
            <Zap className="h-4 w-4" /> Launch Session
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function DevinSessionCard({
  session,
  onEscalate,
}: {
  session: DevinSession;
  onEscalate: (sessionId: string, newLimitCents: number, limitField: string) => Promise<void>;
}) {
  const [escalating, setEscalating] = useState(false);
  const hasRejection = session.last_rejection_reason !== null;

  const escalateLimit = async () => {
    setEscalating(true);
    try {
      const field = rejectionToField(session.last_rejection_reason ?? "");
      const current = fieldToCurrent(session, field);
      await onEscalate(session.id, current * 2, field);
    } finally {
      setEscalating(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex min-w-0 items-center gap-2">
            <Bot className="h-5 w-5 shrink-0 text-flux-cyan" />
            <span className="truncate">{session.agent_name}</span>
            <Badge tone={STATUS_TONES[session.status]} dot>
              {session.status}
            </Badge>
          </span>
        }
        subtitle={`Launched ${relativeTime(session.created_at)} \u00b7 Last active ${relativeTime(session.updated_at)}`}
      />
      <CardBody className="space-y-4">
        <div className="rounded-lg border border-line bg-bg-raised/30 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Task
          </h3>
          <p className="mt-2 text-sm leading-6 text-ink">{session.task}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Total Spend" value={formatCents(session.total_spent_cents)} icon={Wallet} />
          <MiniStat
            label="Approved"
            value={String(session.transactions_approved)}
            icon={ReceiptText}
          />
          <MiniStat
            label="Rejected"
            value={String(session.transactions_rejected)}
            icon={ShieldAlert}
            alert={session.transactions_rejected > 0}
          />
          <MiniStat
            label="Wallet"
            value={session.wallet_name}
            icon={TrendingUp}
          />
        </div>

        <div className="rounded-lg border border-line bg-bg-raised/30 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Spend Policy Limits
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <LimitPill label="Per transaction" cents={session.per_tx_limit_cents} />
            <LimitPill label="Hourly" cents={session.hourly_limit_cents} />
            <LimitPill label="Daily" cents={session.daily_limit_cents} />
          </div>
        </div>

        {hasRejection && session.status === "running" && (
          <div className="rounded-lg border border-flux-red/30 bg-flux-red/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-flux-red">
                  Budget Escalation Needed
                </h3>
                <p className="mt-1 text-xs text-ink-muted">
                  Devin hit a policy limit:{" "}
                  <code className="rounded bg-bg-raised px-1 py-0.5 font-mono text-xs text-ink">
                    {session.last_rejection_reason}
                  </code>
                  . Approve a limit increase to let Devin continue.
                </p>
              </div>
              <Button
                size="sm"
                onClick={escalateLimit}
                loading={escalating}
                disabled={escalating}
              >
                <TrendingUp className="h-3.5 w-3.5" /> Double Limit
              </Button>
            </div>
          </div>
        )}

        {session.devin_session_url && (
          <div className="flex justify-end">
            <a
              href={session.devin_session_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-flux-cyan hover:underline"
            >
              View in Devin <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
  alert,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
  alert?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-bg-raised/30 px-3 py-2">
      <Icon
        className={`h-4 w-4 shrink-0 ${alert ? "text-flux-red" : "text-ink-muted"}`}
      />
      <div className="min-w-0">
        <p className="truncate text-xs text-ink-muted">{label}</p>
        <p className={`truncate text-sm font-semibold ${alert ? "text-flux-red" : "text-ink"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function LimitPill({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="rounded-md border border-line bg-bg-base px-3 py-2 text-center">
      <p className="text-[11px] text-ink-muted">{label}</p>
      <p className="text-sm font-semibold text-ink">{formatCents(cents)}</p>
    </div>
  );
}

function rejectionToField(reason: string): string {
  if (reason.includes("per_tx")) return "per_tx_limit_cents";
  if (reason.includes("hourly")) return "hourly_limit_cents";
  if (reason.includes("daily")) return "daily_limit_cents";
  return "per_tx_limit_cents";
}

function fieldToCurrent(session: DevinSession, field: string): number {
  if (field === "per_tx_limit_cents") return session.per_tx_limit_cents;
  if (field === "hourly_limit_cents") return session.hourly_limit_cents;
  if (field === "daily_limit_cents") return session.daily_limit_cents;
  return session.per_tx_limit_cents;
}
