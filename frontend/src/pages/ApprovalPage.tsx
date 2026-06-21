import { useCallback, useState } from "react";
import { CheckCircle, XCircle, Clock, ShieldAlert, Coins } from "lucide-react";
import { api } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useRefreshOnFocus } from "@/hooks/useInterval";
import { useToast } from "@/context/ToastContext";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCents, relativeTime } from "@/lib/utils";
import type { ApprovalQueueItem } from "@/types";

export function ApprovalPage() {
  const { toast } = useToast();
  const stats = useAsync(() => api.getApprovalStats(), []);
  const queue = useAsync(() => api.listPendingApprovals(), []);

  const refreshAll = useCallback(() => {
    stats.refresh();
    queue.refresh();
  }, [stats, queue]);

  useRefreshOnFocus(refreshAll);

  const handleApprove = async (id: string) => {
    try {
      await api.approveTransaction(id);
      toast("success", "Transaction approved", "Payment token issued");
      refreshAll();
    } catch {
      toast("error", "Failed to approve");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.rejectTransaction(id, "operator_rejected");
      toast("success", "Transaction rejected");
      refreshAll();
    } catch {
      toast("error", "Failed to reject");
    }
  };

  if (stats.loading && !stats.data) return <LoadingState label="Loading approval queue..." />;
  const s = stats.data;

  return (
    <>
      <PageHeader
        title="Approval Queue"
        subtitle="Human-in-the-loop review for high-value agent transactions exceeding the approval threshold."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending" value={s?.pendingCount ?? 0} icon={Clock} tone="amber" hint="Transactions awaiting your decision" />
        <StatCard label="Total Value" value={formatCents(s?.totalValue ?? 0)} icon={Coins} tone="cyan" hint="Sum of all pending amounts" />
        <StatCard label="Approved Today" value={s?.approvedToday ?? 0} icon={CheckCircle} tone="green" hint="Transactions you approved" />
        <StatCard label="Rejected Today" value={s?.rejectedToday ?? 0} icon={XCircle} tone="red" hint="Transactions you rejected" />
      </div>

      <Card>
        <CardHeader title="Pending Transactions" subtitle="Review and approve or reject high-value agent spend requests" />
        <div className="p-0">
          {queue.loading && !queue.data ? (
            <div className="p-6"><LoadingState label="Loading..." /></div>
          ) : !queue.data?.length ? (
            <div className="p-6"><EmptyState icon={ShieldAlert} title="Queue is empty" description="No transactions are waiting for approval. High-value requests will appear here." /></div>
          ) : (
            <div className="divide-y divide-line">
              {queue.data.map((item) => (
                <ApprovalRow key={item.id} item={item} onApprove={handleApprove} onReject={handleReject} />
              ))}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

function ApprovalRow({ item, onApprove, onReject }: { item: ApprovalQueueItem; onApprove: (id: string) => void; onReject: (id: string) => void }) {
  const [busy, setBusy] = useState(false);

  const handleApprove = async () => {
    setBusy(true);
    await onApprove(item.id);
    setBusy(false);
  };

  const handleReject = async () => {
    setBusy(true);
    await onReject(item.id);
    setBusy(false);
  };

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">{item.agentName}</span>
          <span className="text-xs text-ink-muted">→</span>
          <span className="truncate text-xs font-mono text-ink-muted">{item.payeeUrl}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-ink-muted">
          <span className="font-semibold text-flux-amber">{formatCents(item.requestedAmountCents)}</span>
          <span>{item.description}</span>
          <span>{relativeTime(item.createdAt)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={handleReject} loading={busy} className="!text-flux-red hover:!bg-flux-red/10">
          <XCircle className="h-4 w-4" /> Reject
        </Button>
        <Button variant="primary" onClick={handleApprove} loading={busy}>
          <CheckCircle className="h-4 w-4" /> Approve
        </Button>
      </div>
    </div>
  );
}
