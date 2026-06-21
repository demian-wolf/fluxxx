import { useCallback, useState } from "react";
import {
  CreditCard,
  TrendingUp,
  Receipt,
  Check,
  Crown,
  Zap,
} from "lucide-react";
import { api } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useRefreshOnFocus } from "@/hooks/useInterval";
import { useToast } from "@/context/ToastContext";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/Spinner";
import { formatCents, relativeTime, cn } from "@/lib/utils";
import type { SaasPlan, SaasTier, FeeEvent } from "@/types";

export function BillingPage() {
  const { toast } = useToast();
  const [switching, setSwitching] = useState<SaasTier | null>(null);

  const billing = useAsync(() => api.getBillingAccount(), []);
  const plans = useAsync(() => api.listPlans(), []);
  const fees = useAsync(() => api.listFeeEvents(), []);

  const refreshAll = useCallback(() => {
    billing.refresh();
    fees.refresh();
  }, [billing, fees]);

  useRefreshOnFocus(refreshAll);

  const handleChangePlan = async (tier: SaasTier) => {
    setSwitching(tier);
    try {
      await api.changePlan(tier);
      billing.refresh();
      toast("success", `Switched to ${tier} plan`);
    } catch {
      toast("error", "Could not change plan");
    } finally {
      setSwitching(null);
    }
  };

  if (billing.loading && !billing.data) {
    return <LoadingState label="Loading billing..." />;
  }

  const b = billing.data;

  return (
    <>
      <PageHeader
        title="Billing & Fees"
        subtitle={
          <>
            {"Stripe for agents — "}
            <span className="font-mono text-flux-cyan">
              {b ? `${(b.tx_fee_bps / 100).toFixed(1)}%` : "—"}
            </span>
            {" per agent spend."}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Current Plan"
          value={b?.tier.toUpperCase() ?? "—"}
          icon={Crown}
          tone="violet"
          hint="Active subscription tier"
        />
        <StatCard
          label="Transaction Fee"
          value={b ? `${(b.tx_fee_bps / 100).toFixed(1)}%` : "—"}
          icon={CreditCard}
          tone="cyan"
          hint="Applied to every agent spend"
        />
        <StatCard
          label="Monthly Volume"
          value={formatCents(b?.monthly_volume_cents ?? 0)}
          icon={TrendingUp}
          tone="green"
          hint="Total agent spend this billing period"
        />
        <StatCard
          label="Fees Collected"
          value={formatCents(b?.total_fees_collected_cents ?? 0)}
          icon={Receipt}
          tone="amber"
          hint={`${b?.total_transactions_billed ?? 0} transactions billed`}
        />
      </div>

      <Card className="mb-6">
        <CardHeader
          title="SaaS Plans"
          subtitle="Choose the tier that fits your agent fleet"
        />
        <CardBody>
          <div className="grid gap-4 md:grid-cols-3">
            {(plans.data ?? []).map((plan) => (
              <PlanCard
                key={plan.tier}
                plan={plan}
                current={b?.tier ?? "free"}
                switching={switching}
                onSelect={handleChangePlan}
              />
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Fee Ledger"
          subtitle="Per-transaction platform fee breakdown"
        />
        <div className="p-0">
          {fees.loading && !fees.data ? (
            <div className="p-6">
              <LoadingState label="Loading fees..." />
            </div>
          ) : !fees.data?.length ? (
            <div className="p-6">
              <EmptyState
                icon={Receipt}
                title="No fees yet"
                description="Transaction fees appear here as agents spend."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3 text-right">Gross</th>
                    <th className="px-4 py-3 text-right">Fee</th>
                    <th className="px-4 py-3 text-right">Net</th>
                    <th className="px-4 py-3 text-right">Rate</th>
                    <th className="px-4 py-3 text-right">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {fees.data.map((f) => (
                    <FeeRow key={f.id} fee={f} />
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

function PlanCard({
  plan,
  current,
  switching,
  onSelect,
}: {
  plan: SaasPlan;
  current: SaasTier;
  switching: SaasTier | null;
  onSelect: (tier: SaasTier) => void;
}) {
  const isCurrent = plan.tier === current;
  return (
    <div
      className={cn(
        "relative rounded-xl border p-5 transition",
        isCurrent
          ? "border-flux-cyan bg-flux-cyan/5"
          : "border-line hover:border-ink-faint",
      )}
    >
      {isCurrent && (
        <Badge tone="cyan" className="absolute right-4 top-4">
          current
        </Badge>
      )}
      <h3 className="text-lg font-semibold text-ink">{plan.label}</h3>
      <p className="mt-1 font-mono text-2xl font-bold text-ink">
        {plan.price_cents_monthly === 0
          ? "Free"
          : `${formatCents(plan.price_cents_monthly)}/mo`}
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        {(plan.tx_fee_bps / 100).toFixed(1)}% per transaction
      </p>
      <ul className="mt-4 space-y-2">
        {plan.features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-xs text-ink-muted">
            <Check className="h-3.5 w-3.5 shrink-0 text-flux-green" />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-5">
        {isCurrent ? (
          <Button variant="ghost" disabled className="w-full">
            Current plan
          </Button>
        ) : (
          <Button
            className="w-full"
            loading={switching === plan.tier}
            onClick={() => onSelect(plan.tier)}
          >
            <Zap className="h-4 w-4" />
            {plan.tier === "enterprise" ? "Contact sales" : "Upgrade"}
          </Button>
        )}
      </div>
    </div>
  );
}

function FeeRow({ fee }: { fee: FeeEvent }) {
  return (
    <tr className="transition hover:bg-bg-raised/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 shrink-0 text-flux-cyan" />
          <span className="font-medium text-ink">{fee.agent_name}</span>
        </div>
        <p className="mt-0.5 pl-6 font-mono text-xs text-ink-faint">
          {fee.transaction_id.slice(0, 12)}...
        </p>
      </td>
      <td className="px-4 py-3 text-right font-mono text-ink">
        {formatCents(fee.gross_amount_cents)}
      </td>
      <td className="px-4 py-3 text-right font-mono text-flux-amber">
        -{formatCents(fee.fee_cents)}
      </td>
      <td className="px-4 py-3 text-right font-mono text-flux-green">
        {formatCents(fee.net_amount_cents)}
      </td>
      <td className="px-4 py-3 text-right text-xs text-ink-muted">
        {(fee.fee_bps / 100).toFixed(1)}%
      </td>
      <td className="px-4 py-3 text-right text-xs text-ink-muted">
        {relativeTime(fee.created_at)}
      </td>
    </tr>
  );
}
