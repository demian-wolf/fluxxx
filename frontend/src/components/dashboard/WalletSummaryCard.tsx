import { Link } from "react-router-dom";
import { ArrowUpRight, Plus, TrendingDown, TrendingUp } from "lucide-react";
import type { AgentWallet, WalletAnalytics } from "@/types";
import { Card } from "@/components/ui/Card";
import { WalletStatusBadge } from "@/components/ui/StatusBadge";
import { formatCents } from "@/lib/utils";

export function WalletSummaryCard({
  wallet,
  analytics,
}: {
  wallet: AgentWallet;
  analytics: WalletAnalytics | null;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="relative p-5">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-30 blur-2xl"
          style={{
            background:
              "radial-gradient(circle, rgba(34,211,238,0.5), transparent 70%)",
          }}
        />
        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">{wallet.name}</p>
            <WalletStatusBadge status={wallet.status} />
          </div>

          <p className="mt-5 text-xs font-medium uppercase tracking-wide text-ink-muted">
            Balance
          </p>
          <p className="mt-1 font-mono text-4xl font-bold tracking-tight text-ink">
            {formatCents(wallet.balance_cents)}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-line bg-bg-raised/40 p-3">
              <p className="flex items-center gap-1 text-xs text-ink-muted">
                <TrendingUp className="h-3.5 w-3.5 text-flux-green" /> Deposited
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-ink">
                {analytics ? formatCents(analytics.total_deposited_cents) : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-line bg-bg-raised/40 p-3">
              <p className="flex items-center gap-1 text-xs text-ink-muted">
                <TrendingDown className="h-3.5 w-3.5 text-flux-amber" /> Spent
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-ink">
                {analytics ? formatCents(analytics.total_spent_cents) : "—"}
              </p>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <Link
              to={`/wallets/${wallet.id}/deposit`}
              className="btn-primary flex-1"
            >
              <Plus className="h-4 w-4" /> Add Funds
            </Link>
            <Link to={`/wallets/${wallet.id}`} className="btn-ghost">
              Details <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}
