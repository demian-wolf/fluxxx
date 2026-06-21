import { useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plus, TriangleAlert, Wallet, X } from "lucide-react";
import { api } from "@/api";
import { useAuth } from "@/context/AuthContext";
import { useWallets } from "@/context/WalletContext";
import { useAsync } from "@/hooks/useAsync";
import { useLiveLedger } from "@/hooks/useLiveLedger";
import { useRefreshOnFocus } from "@/hooks/useInterval";
import { PageHeader } from "@/components/PageHeader";
import { WalletSummaryCard } from "@/components/dashboard/WalletSummaryCard";
import { LiveFeed } from "@/components/dashboard/LiveFeed";
import { AgentStatusPanel } from "@/components/dashboard/AgentStatusPanel";
import { GcStatusWidget } from "@/components/dashboard/GcStatusWidget";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/Spinner";

export function DashboardPage() {
  const { user, justRegistered, clearJustRegistered } = useAuth();
  const { selected, loading: walletsLoading, refresh: refreshWallets } =
    useWallets();
  const walletId = selected?.id ?? null;

  const analytics = useAsync(
    () => (walletId ? api.getWalletAnalytics(walletId) : Promise.resolve(null)),
    [walletId],
  );

  const gcStatus = useAsync(() => api.getGcStatus(), []);

  const onLive = useCallback(() => {
    analytics.refresh();
    gcStatus.refresh();
    refreshWallets();
  }, [analytics, gcStatus, refreshWallets]);
  useLiveLedger(onLive);
  useRefreshOnFocus(onLive);

  const firstName = user?.full_name?.split(" ")[0] ?? "operator";

  if (walletsLoading) return <LoadingState label="Loading command center…" />;

  if (!selected) {
    return (
      <>
        <PageHeader
          title={`Welcome, ${firstName}`}
          subtitle="Your agentic commerce command center."
        />
        <div className="card">
          <EmptyState
            icon={Wallet}
            title="Create your first wallet to get started"
            description="A wallet is the funded account that backs your agents. Fund it via Mollie, then register agents against it."
            action={
              <Link to="/wallets" className="btn-primary mt-1">
                <Plus className="h-4 w-4" /> Create wallet
              </Link>
            }
          />
        </div>
      </>
    );
  }

  const lowBalance = selected.balance_cents <= 0;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle="Real-time visibility into what your agents are spending, where, and why."
      />

      {justRegistered && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-flux-cyan/30 bg-flux-cyan/10 px-4 py-3">
          <p className="text-sm text-ink">
            Account created. Fund a wallet and register your first agent to get
            started.
          </p>
          <div className="flex items-center gap-2">
            <Link
              to={`/wallets/${selected.id}/deposit`}
              className="btn-primary !py-1.5 text-xs"
            >
              Add funds <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              onClick={clearJustRegistered}
              className="text-ink-muted hover:text-ink"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {lowBalance && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-flux-amber/30 bg-flux-amber/10 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-flux-amber">
            <TriangleAlert className="h-4 w-4" />
            Wallet balance is depleted. Agents on this wallet cannot spend until
            you add funds.
          </p>
          <Link
            to={`/wallets/${selected.id}/deposit`}
            className="btn-primary !py-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Add Funds
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <WalletSummaryCard wallet={selected} analytics={analytics.data} />
          <GcStatusWidget status={gcStatus.data} />
        </div>
        <div className="lg:col-span-6">
          <LiveFeed walletId={selected.id} />
        </div>
        <div className="lg:col-span-3">
          <AgentStatusPanel agents={analytics.data?.agents ?? []} />
        </div>
      </div>
    </>
  );
}
