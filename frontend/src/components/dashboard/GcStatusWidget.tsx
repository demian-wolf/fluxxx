import { Link } from "react-router-dom";
import { ArrowUpRight, Recycle } from "lucide-react";
import type { GcStatus } from "@/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { formatCents, relativeTime } from "@/lib/utils";

export function GcStatusWidget({ status }: { status: GcStatus | null }) {
  if (!status) return null;

  return (
    <Card className="mt-4">
      <CardHeader
        title="Capital Reclamation"
        right={
          <Link to="/gc" className="btn-ghost !px-2.5 !py-1.5 text-xs">
            View <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-line bg-bg-raised/40 p-3">
            <p className="flex items-center gap-1 text-xs text-ink-muted">
              <Recycle className="h-3.5 w-3.5 text-flux-cyan" /> Reclaimed
            </p>
            <p className="mt-1 font-mono text-sm font-semibold text-ink">
              {status.total_events}
              <span className="ml-1 text-xs font-normal text-ink-faint">
                agents
              </span>
            </p>
          </div>
          <div className="rounded-lg border border-line bg-bg-raised/40 p-3">
            <p className="flex items-center gap-1 text-xs text-ink-muted">
              <Recycle className="h-3.5 w-3.5 text-flux-green" /> Budget Freed
            </p>
            <p className="mt-1 font-mono text-sm font-semibold text-ink">
              {formatCents(status.total_limit_freed)}
            </p>
          </div>
        </div>
        {status.last_sweep_at && (
          <p className="mt-3 text-xs text-ink-faint">
            Last sweep: {relativeTime(status.last_sweep_at)}
          </p>
        )}
      </div>
    </Card>
  );
}
