import { useCallback, useState } from "react";
import {
  Store,
  ShieldCheck,
  Clock,
  TrendingUp,
  Globe,
  BadgeCheck,
} from "lucide-react";
import { api } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useRefreshOnFocus } from "@/hooks/useInterval";
import { useToast } from "@/context/ToastContext";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/Spinner";
import { formatCents, relativeTime } from "@/lib/utils";
import type { MarketplaceProvider, ProviderStatus } from "@/types";

const statusTone: Record<ProviderStatus, "green" | "amber" | "red"> = {
  verified: "green",
  pending: "amber",
  suspended: "red",
};

export function ProvidersPage() {
  const { toast } = useToast();
  const [verifying, setVerifying] = useState<string | null>(null);

  const stats = useAsync(() => api.getProviderStats(), []);
  const providers = useAsync(() => api.listProviders(), []);

  const refreshAll = useCallback(() => {
    stats.refresh();
    providers.refresh();
  }, [stats, providers]);

  useRefreshOnFocus(refreshAll);

  const handleVerify = async (id: string) => {
    setVerifying(id);
    try {
      await api.verifyProvider(id);
      refreshAll();
      toast("success", "Provider verified");
    } catch {
      toast("error", "Verification failed");
    } finally {
      setVerifying(null);
    }
  };

  if (stats.loading && !stats.data) {
    return <LoadingState label="Loading provider marketplace..." />;
  }

  const s = stats.data;

  return (
    <>
      <PageHeader
        title="Provider Marketplace"
        subtitle="Payee verification registry — providers pay a verification fee to join the FLUX marketplace."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Providers"
          value={s?.total_providers ?? 0}
          icon={Store}
          tone="cyan"
          hint="Registered payee providers"
        />
        <StatCard
          label="Verified"
          value={s?.verified_providers ?? 0}
          icon={ShieldCheck}
          tone="green"
          hint="Providers passing KYP verification"
        />
        <StatCard
          label="Verification Revenue"
          value={formatCents(s?.total_verification_revenue_cents ?? 0)}
          icon={TrendingUp}
          tone="violet"
          hint="Total fees from provider verification"
        />
        <StatCard
          label="Pending"
          value={s?.pending_verifications ?? 0}
          icon={Clock}
          tone="amber"
          hint="Awaiting verification review"
        />
      </div>

      <Card>
        <CardHeader
          title="Provider Registry"
          subtitle="Paywall providers registered to accept FLUX payment tokens"
        />
        <div className="p-0">
          {providers.loading && !providers.data ? (
            <div className="p-6">
              <LoadingState label="Loading providers..." />
            </div>
          ) : !providers.data?.length ? (
            <div className="p-6">
              <EmptyState
                icon={Globe}
                title="No providers registered"
                description="Providers register to accept FLUX payment tokens and pay a one-time verification fee."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Verification Fee</th>
                    <th className="px-4 py-3 text-right">Verifications</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                    <th className="px-4 py-3 text-right">Registered</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {providers.data.map((provider) => (
                    <ProviderRow
                      key={provider.id}
                      provider={provider}
                      verifying={verifying}
                      onVerify={handleVerify}
                    />
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

function ProviderRow({
  provider,
  verifying,
  onVerify,
}: {
  provider: MarketplaceProvider;
  verifying: string | null;
  onVerify: (id: string) => void;
}) {
  return (
    <tr className="transition hover:bg-bg-raised/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 shrink-0 text-flux-cyan" />
          <div>
            <span className="font-medium text-ink">{provider.name}</span>
            <p className="text-xs text-ink-faint">{provider.domain}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge tone={statusTone[provider.status]} dot>
          {provider.status}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right font-mono text-ink">
        {formatCents(provider.verification_fee_cents)}
      </td>
      <td className="px-4 py-3 text-right font-mono text-ink">
        {provider.total_verifications.toLocaleString()}
      </td>
      <td className="px-4 py-3 text-right font-mono text-flux-green">
        {formatCents(provider.total_revenue_cents)}
      </td>
      <td className="px-4 py-3 text-right text-xs text-ink-muted">
        {relativeTime(provider.created_at)}
      </td>
      <td className="px-4 py-3 text-right">
        {provider.status === "pending" ? (
          <Button
            size="sm"
            loading={verifying === provider.id}
            onClick={() => onVerify(provider.id)}
          >
            <BadgeCheck className="h-3.5 w-3.5" />
            Verify
          </Button>
        ) : (
          <span className="text-xs text-ink-faint">—</span>
        )}
      </td>
    </tr>
  );
}
