import { useCallback } from "react";
import { Clock, TrendingDown, AlertTriangle, Gauge } from "lucide-react";
import { api } from "@/api";
import { useWallets } from "@/context/WalletContext";
import { useAsync } from "@/hooks/useAsync";
import { useRefreshOnFocus } from "@/hooks/useInterval";
import { useLiveLedger } from "@/hooks/useLiveLedger";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { ProgressBar, meterTone } from "@/components/ui/ProgressBar";
import { LoadingState } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCents } from "@/lib/utils";

export function ForecastPage() {
  const { selected } = useWallets();
  const walletId = selected?.id ?? null;

  const forecast = useAsync(
    () => (walletId ? api.getForecast(walletId) : Promise.resolve(null)),
    [walletId],
  );

  const refreshAll = useCallback(() => {
    forecast.refresh();
  }, [forecast]);

  useLiveLedger(refreshAll);
  useRefreshOnFocus(refreshAll);

  if (!selected) {
    return (
      <>
        <PageHeader title="Budget Forecasting" subtitle="Depletion prediction based on rolling spend velocity." />
        <Card><CardBody><EmptyState icon={TrendingDown} title="No wallet selected" description="Select or create a wallet to see forecasting." /></CardBody></Card>
      </>
    );
  }

  if (forecast.loading && !forecast.data) return <LoadingState label="Calculating forecast..." />;

  const f = forecast.data;
  if (!f) return null;

  const formatHours = (h: number | null) => {
    if (h === null) return "∞";
    if (h < 1) return `${Math.round(h * 60)}m`;
    if (h < 24) return `${h.toFixed(1)}h`;
    return `${(h / 24).toFixed(1)}d`;
  };

  const urgency = f.hoursUntilOob !== null && f.hoursUntilOob < 2 ? "red"
    : f.hoursUntilOob !== null && f.hoursUntilOob < 12 ? "amber"
    : "cyan";

  return (
    <>
      <PageHeader
        title="Budget Forecasting"
        subtitle={`Depletion prediction for "${selected.name}" based on 24h rolling spend velocity.`}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Burn Rate"
          value={`${formatCents(Math.round(f.burnRate.centsPerHour))}/hr`}
          icon={Gauge}
          tone="cyan"
          hint={`${formatCents(Math.round(f.burnRate.centsPerDay))}/day`}
        />
        <StatCard
          label="Time to Depletion"
          value={formatHours(f.hoursRemaining)}
          icon={Clock}
          tone={urgency}
          hint={f.depletesAt ? `Depletes: ${new Date(f.depletesAt).toLocaleString()}` : "No active burn"}
        />
        <StatCard
          label="Time to OOB Kill"
          value={formatHours(f.hoursUntilOob)}
          icon={AlertTriangle}
          tone={urgency}
          hint={`OOB threshold: ${formatCents(f.oobThresholdCents)}`}
        />
        <StatCard
          label="Confidence"
          value={f.confidence.toUpperCase()}
          icon={TrendingDown}
          tone={f.confidence === "high" ? "green" : f.confidence === "medium" ? "amber" : "red"}
          hint="Based on data volume in 24h window"
        />
      </div>

      <Card>
        <CardHeader
          title="Agent Burn Rates"
          subtitle="Per-agent contribution to wallet spend velocity"
        />
        <div className="p-4">
          {f.agentBurnRates.length === 0 ? (
            <EmptyState icon={TrendingDown} title="No spend data" description="Agents haven't spent yet in this window." />
          ) : (
            <div className="space-y-3">
              {f.agentBurnRates.map((ab) => (
                <div key={ab.agentId} className="rounded-lg border border-line bg-bg-raised/30 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-ink">{ab.agentName}</span>
                    <span className="font-mono text-xs text-ink-muted">
                      {formatCents(Math.round(ab.centsPerHour))}/hr ({ab.percentOfTotal.toFixed(0)}%)
                    </span>
                  </div>
                  <ProgressBar
                    percent={ab.percentOfTotal}
                    tone={meterTone(ab.percentOfTotal)}
                    className="mt-2"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
