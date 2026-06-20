import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Pause, Play, Plus } from "lucide-react";
import { api } from "@/api";
import { useToast } from "@/context/ToastContext";
import { useWallets } from "@/context/WalletContext";
import { useAsync } from "@/hooks/useAsync";
import { useLiveLedger } from "@/hooks/useLiveLedger";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { WalletStatusBadge } from "@/components/ui/StatusBadge";
import { LoadingState, ErrorState } from "@/components/ui/Spinner";
import { SpendLineChart } from "@/components/charts/SpendLineChart";
import { LedgerTable } from "@/components/domain/LedgerTable";
import { formatCents } from "@/lib/utils";

export function WalletDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refresh: refreshContext } = useWallets();

  const wallet = useAsync(() => api.getWallet(id), [id]);
  const analytics = useAsync(() => api.getWalletAnalytics(id), [id]);
  const ledger = useAsync(() => api.listLedger(id), [id]);
  const series = useAsync(() => api.getWalletSpendSeries(id), [id]);
  const agents = useAsync(() => api.listAgents(), []);
  const [busy, setBusy] = useState(false);

  const refreshLive = useCallback(() => {
    wallet.refresh();
    analytics.refresh();
    ledger.refresh();
    series.refresh();
  }, [wallet, analytics, ledger, series]);
  useLiveLedger(refreshLive);

  const walletAgents = useMemo(
    () => (agents.data ?? []).filter((a) => a.wallet_id === id),
    [agents.data, id],
  );

  if (wallet.loading) return <LoadingState />;
  if (wallet.error || !wallet.data)
    return <ErrorState message={wallet.error ?? "not found"} onRetry={wallet.refresh} />;

  const w = wallet.data;
  const isActive = w.status === "active";

  const toggleSuspend = async () => {
    setBusy(true);
    try {
      await api.setWalletStatus(id, isActive ? "suspended" : "active");
      toast(
        "success",
        isActive ? "Wallet suspended" : "Wallet reactivated",
        isActive ? "Agents can no longer spend from it." : "Spending re-enabled.",
      );
      refreshLive();
      refreshContext();
    } catch {
      toast("error", "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title={w.name}
        crumbs={[{ label: "Wallets", to: "/wallets" }, { label: w.name }]}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <WalletStatusBadge status={w.status} />
            <span className="font-mono text-xs text-ink-faint">{w.id}</span>
          </span>
        }
        actions={
          <>
            <Button onClick={() => navigate(`/wallets/${id}/deposit`)}>
              <Plus className="h-4 w-4" /> Add Funds
            </Button>
            <Button variant={isActive ? "danger" : "ghost"} onClick={toggleSuspend} loading={busy}>
              {isActive ? (
                <>
                  <Pause className="h-4 w-4" /> Suspend
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" /> Reactivate
                </>
              )}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Balance" value={formatCents(w.balance_cents)} tone="cyan" />
        <StatCard
          label="Total deposited"
          value={analytics.data ? formatCents(analytics.data.total_deposited_cents) : "—"}
          tone="green"
        />
        <StatCard
          label="Total spent"
          value={analytics.data ? formatCents(analytics.data.total_spent_cents) : "—"}
          tone="amber"
        />
        <StatCard label="Agents" value={walletAgents.length} tone="violet" />
      </div>

      <Card className="mt-4">
        <CardHeader title="Spend over last 24 hours" subtitle="Hourly aggregated spend across all agents" />
        <CardBody>
          {series.loading ? (
            <LoadingState />
          ) : (
            <SpendLineChart data={series.data ?? []} height={240} />
          )}
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Ledger" subtitle="Append-only record of every balance change" />
        {ledger.loading ? (
          <LoadingState />
        ) : (
          <LedgerTable
            entries={ledger.data ?? []}
            agentOptions={walletAgents.map((a) => ({ value: a.id, label: a.name }))}
          />
        )}
      </Card>
    </>
  );
}
