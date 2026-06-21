import { Link } from "react-router-dom";
import { ArrowUpRight, ShieldAlert } from "lucide-react";
import type { OobStatus } from "@/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { relativeTime } from "@/lib/utils";

export function OobStatusWidget({ status }: { status: OobStatus | null }) {
  if (!status) return null;

  return (
    <Card className="mt-4">
      <CardHeader
        title="OOB Killer"
        right={
          <Link to="/oob" className="btn-ghost !px-2.5 !py-1.5 text-xs">
            View <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-line bg-bg-raised/40 p-3">
            <p className="flex items-center gap-1 text-xs text-ink-muted">
              <ShieldAlert className="h-3.5 w-3.5 text-flux-red" /> Kills
            </p>
            <p className="mt-1 font-mono text-sm font-semibold text-ink">
              {status.total_events}
              <span className="ml-1 text-xs font-normal text-ink-faint">
                events
              </span>
            </p>
          </div>
          <div className="rounded-lg border border-line bg-bg-raised/40 p-3">
            <p className="flex items-center gap-1 text-xs text-ink-muted">
              <ShieldAlert className="h-3.5 w-3.5 text-flux-amber" /> Terminated
            </p>
            <p className="mt-1 font-mono text-sm font-semibold text-ink">
              {status.total_agents_killed}
              <span className="ml-1 text-xs font-normal text-ink-faint">
                agents
              </span>
            </p>
          </div>
        </div>
        {status.last_triggered_at && (
          <p className="mt-3 text-xs text-ink-faint">
            Last kill: {relativeTime(status.last_triggered_at)}
          </p>
        )}
      </div>
    </Card>
  );
}
