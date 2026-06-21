import { useCallback } from "react";
import {
  KeyRound,
  Layers,
  TrendingUp,
  Activity,
  Globe,
  Mail,
} from "lucide-react";
import { api } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useRefreshOnFocus } from "@/hooks/useInterval";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/Spinner";
import { formatCents, relativeTime, pct } from "@/lib/utils";
import type { WhiteLabelLicense, LicenseStatus } from "@/types";

const statusTone: Record<LicenseStatus, "green" | "amber" | "red"> = {
  active: "green",
  trial: "amber",
  expired: "red",
};

export function LicensingPage() {
  const stats = useAsync(() => api.getLicensingStats(), []);
  const licenses = useAsync(() => api.listLicenses(), []);

  const refreshAll = useCallback(() => {
    stats.refresh();
    licenses.refresh();
  }, [stats, licenses]);

  useRefreshOnFocus(refreshAll);

  if (stats.loading && !stats.data) {
    return <LoadingState label="Loading licensing data..." />;
  }

  const s = stats.data;

  return (
    <>
      <PageHeader
        title="White-Label Licensing"
        subtitle="Embedded FLUX licensing for agent platforms — LangChain, CrewAI, AutoGen and more."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Licenses"
          value={s?.total_licenses ?? 0}
          icon={KeyRound}
          tone="cyan"
          hint="Platform integration licenses"
        />
        <StatCard
          label="Active"
          value={s?.active_licenses ?? 0}
          icon={Layers}
          tone="green"
          hint="Currently active licenses"
        />
        <StatCard
          label="Monthly Revenue"
          value={formatCents(s?.total_monthly_revenue_cents ?? 0)}
          icon={TrendingUp}
          tone="violet"
          hint="Total licensing revenue this month"
        />
        <StatCard
          label="API Calls"
          value={(s?.total_api_calls ?? 0).toLocaleString()}
          icon={Activity}
          tone="amber"
          hint="Total API calls across all licensees"
        />
      </div>

      <Card>
        <CardHeader
          title="Platform Licenses"
          subtitle="Agent platforms embedding FLUX as their payment/policy layer"
        />
        <div className="p-0">
          {licenses.loading && !licenses.data ? (
            <div className="p-6">
              <LoadingState label="Loading licenses..." />
            </div>
          ) : !licenses.data?.length ? (
            <div className="p-6">
              <EmptyState
                icon={Globe}
                title="No licenses issued"
                description="White-label licenses allow agent platforms to embed FLUX identity and payment infrastructure."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                    <th className="px-4 py-3">Platform</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Monthly Fee</th>
                    <th className="px-4 py-3">API Usage</th>
                    <th className="px-4 py-3 text-right">Expires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {licenses.data.map((license) => (
                    <LicenseRow key={license.id} license={license} />
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

function LicenseRow({ license }: { license: WhiteLabelLicense }) {
  const usagePct = license.api_call_limit
    ? pct(license.api_calls_this_month, license.api_call_limit)
    : 0;
  const usageTone =
    usagePct >= 90 ? "red" : usagePct >= 70 ? "amber" : "cyan";

  return (
    <tr className="transition hover:bg-bg-raised/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 shrink-0 text-flux-violet" />
          <div>
            <span className="font-medium text-ink">{license.platform}</span>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-faint">
              <Mail className="h-3 w-3" />
              {license.contact_email}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge tone={statusTone[license.status]} dot>
          {license.status}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right font-mono text-ink">
        {license.monthly_fee_cents === 0
          ? "Trial"
          : formatCents(license.monthly_fee_cents)}
      </td>
      <td className="px-4 py-3">
        <div className="min-w-[140px]">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>{license.api_calls_this_month.toLocaleString()}</span>
            <span>
              {license.api_call_limit
                ? license.api_call_limit.toLocaleString()
                : "unlimited"}
            </span>
          </div>
          {license.api_call_limit && (
            <ProgressBar percent={usagePct} tone={usageTone} className="mt-1" />
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right text-xs text-ink-muted">
        {relativeTime(license.expires_at)}
      </td>
    </tr>
  );
}
