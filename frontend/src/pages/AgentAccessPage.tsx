import { useCallback, useMemo, useState } from "react";
import {
  CheckCircle,
  Clock,
  KeyRound,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";
import { api } from "@/api";
import { useToast } from "@/context/ToastContext";
import { useAsync } from "@/hooks/useAsync";
import { useRefreshOnFocus } from "@/hooks/useInterval";
import { PageHeader } from "@/components/PageHeader";
import { PolicyFields } from "@/components/domain/PolicyFields";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Input";
import { ErrorState, LoadingState } from "@/components/ui/Spinner";
import { StatCard } from "@/components/ui/StatCard";
import {
  emptyPolicyValues,
  policyValuesToCents,
  type PolicyFormValues,
} from "@/lib/policy";
import { formatCents, parseDomainList, relativeTime, shortId } from "@/lib/utils";
import type {
  AgentAccessLimits,
  AgentAccessRequest,
  ApproveAgentAccessInput,
} from "@/types";

export function AgentAccessPage() {
  const { toast } = useToast();
  const requests = useAsync(() => api.listAgentAccessRequests(), []);

  const refresh = useCallback(() => {
    requests.refresh();
  }, [requests]);

  useRefreshOnFocus(refresh);

  const pending = useMemo(() => requests.data ?? [], [requests.data]);
  const stats = useMemo(() => {
    const walletCount = new Set(pending.map((request) => request.walletId)).size;
    const requestedDaily = pending.reduce(
      (sum, request) => sum + request.requestedLimits.daily_limit_cents,
      0,
    );
    const maxPerTx = pending.reduce(
      (max, request) =>
        Math.max(max, request.requestedLimits.per_tx_limit_cents),
      0,
    );
    return { walletCount, requestedDaily, maxPerTx };
  }, [pending]);

  const handleApprove = async (
    id: string,
    input: ApproveAgentAccessInput,
  ) => {
    try {
      const request = await api.approveAgentAccessRequest(id, input);
      toast(
        "success",
        "Wallet access approved",
        `${request.agentName} can use ${request.walletName}.`,
      );
      refresh();
    } catch {
      toast("error", "Could not approve wallet access");
    }
  };

  const handleDeny = async (id: string, reason?: string) => {
    try {
      const request = await api.denyAgentAccessRequest(id, reason);
      toast("success", "Wallet access denied", request.agentName);
      refresh();
    } catch {
      toast("error", "Could not deny wallet access");
    }
  };

  if (requests.loading && !requests.data) {
    return <LoadingState label="Loading wallet access requests..." />;
  }

  return (
    <>
      <PageHeader
        title="Wallet Access"
        subtitle="Review agent requests for access to human-managed wallets and approve bounded spend limits."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pending"
          value={pending.length}
          icon={Clock}
          tone="amber"
          hint="Requests awaiting operator decision"
        />
        <StatCard
          label="Wallets"
          value={stats.walletCount}
          icon={Wallet}
          tone="cyan"
          hint="Distinct wallets requested"
        />
        <StatCard
          label="Daily Requested"
          value={formatCents(stats.requestedDaily)}
          icon={ShieldCheck}
          tone="violet"
          hint="Combined requested daily limit"
        />
        <StatCard
          label="Highest Tx Cap"
          value={formatCents(stats.maxPerTx)}
          icon={KeyRound}
          tone="green"
          hint="Largest requested per-transaction cap"
        />
      </div>

      {requests.error ? (
        <Card>
          <ErrorState message={requests.error} onRetry={requests.refresh} />
        </Card>
      ) : pending.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="No wallet access requests"
            description="New agent authorization requests will appear here for human review."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {pending.map((request) => (
            <AgentAccessRequestCard
              key={request.id}
              request={request}
              onApprove={handleApprove}
              onDeny={handleDeny}
            />
          ))}
        </div>
      )}
    </>
  );
}

function AgentAccessRequestCard({
  request,
  onApprove,
  onDeny,
}: {
  request: AgentAccessRequest;
  onApprove: (id: string, input: ApproveAgentAccessInput) => Promise<void>;
  onDeny: (id: string, reason?: string) => Promise<void>;
}) {
  const [values, setValues] = useState<PolicyFormValues>(() =>
    limitsToValues(request.requestedLimits),
  );
  const [note, setNote] = useState("");
  const [denyReason, setDenyReason] = useState("");
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);

  const parsedLimits = policyValuesToCents(values);
  const invalidLimits = [
    parsedLimits.per_tx_limit_cents,
    parsedLimits.hourly_limit_cents,
    parsedLimits.daily_limit_cents,
  ].some((amount) => !Number.isFinite(amount) || amount < 0);

  const approve = async () => {
    if (invalidLimits) return;
    setBusy("approve");
    try {
      await onApprove(request.id, {
        limits: {
          ...parsedLimits,
          allowed_domains: parseDomainList(values.allowed),
          blocked_domains: parseDomainList(values.blocked),
        },
        note: note.trim() || undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  const deny = async () => {
    setBusy("deny");
    try {
      await onDeny(request.id, denyReason.trim() || undefined);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{request.agentName}</span>
            <Badge tone="amber" dot>
              pending
            </Badge>
          </span>
        }
        subtitle={`${request.requester} requested ${request.walletName} ${relativeTime(request.createdAt)}`}
      />
      <CardBody className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="space-y-3">
            <div className="rounded-lg border border-line bg-bg-raised/30 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Request details
              </h3>
              <dl className="mt-3 space-y-2 text-sm">
                <Detail label="Agent ID" value={shortId(request.agentId, 14)} mono />
                <Detail label="Wallet" value={request.walletName} />
                <Detail
                  label="Wallet balance"
                  value={formatCents(request.walletBalanceCents)}
                />
                <Detail label="Requester" value={request.requester} />
              </dl>
            </div>
            <div className="rounded-lg border border-line bg-bg-raised/30 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Reason
              </h3>
              <p className="mt-2 text-sm leading-6 text-ink">{request.reason}</p>
            </div>
            <RequestedLimits limits={request.requestedLimits} />
          </div>

          <div className="rounded-lg border border-line bg-bg-raised/30 p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  Approved access limits
                </h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Adjust the requested policy before granting wallet access.
                </p>
              </div>
              <Badge tone="cyan">operator bounded</Badge>
            </div>
            <div className="space-y-4">
              <PolicyFields values={values} onChange={setValues} />
              {invalidLimits && (
                <p className="text-xs text-flux-red">
                  Limits must be valid non-negative amounts.
                </p>
              )}
              <Field label="Approval note (optional)">
                <Input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="e.g. approved for this incident only"
                />
              </Field>
              <Field label="Deny reason (optional)">
                <Input
                  value={denyReason}
                  onChange={(event) => setDenyReason(event.target.value)}
                  placeholder="e.g. requested daily limit is too broad"
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={deny}
            loading={busy === "deny"}
            disabled={busy !== null}
            className="!text-flux-red hover:!bg-flux-red/10"
          >
            <XCircle className="h-4 w-4" /> Deny
          </Button>
          <Button
            type="button"
            onClick={approve}
            loading={busy === "approve"}
            disabled={busy !== null || invalidLimits}
          >
            <CheckCircle className="h-4 w-4" /> Approve access
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function RequestedLimits({ limits }: { limits: AgentAccessLimits }) {
  const allowed =
    limits.allowed_domains.length > 0 ? limits.allowed_domains.join(", ") : "All domains";
  const blocked =
    limits.blocked_domains.length > 0 ? limits.blocked_domains.join(", ") : "None";

  return (
    <div className="rounded-lg border border-line bg-bg-raised/30 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Requested limits
      </h3>
      <dl className="mt-3 space-y-2 text-sm">
        <Detail label="Per transaction" value={formatCents(limits.per_tx_limit_cents)} />
        <Detail label="Hourly" value={formatCents(limits.hourly_limit_cents)} />
        <Detail label="Daily" value={formatCents(limits.daily_limit_cents)} />
        <Detail label="Allowed domains" value={allowed} />
        <Detail label="Blocked domains" value={blocked} />
      </dl>
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className={mono ? "truncate font-mono text-xs text-ink" : "text-ink"}>
        {value}
      </dd>
    </div>
  );
}

function limitsToValues(limits: AgentAccessLimits): PolicyFormValues {
  return {
    ...emptyPolicyValues,
    perTx: centsToInput(limits.per_tx_limit_cents),
    hourly: centsToInput(limits.hourly_limit_cents),
    daily: centsToInput(limits.daily_limit_cents),
    allowed: limits.allowed_domains.join(", "),
    blocked: limits.blocked_domains.join(", "),
  };
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
