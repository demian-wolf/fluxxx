import { useCallback } from "react";
import { Link } from "react-router-dom";
import { Shield, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { api } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useRefreshOnFocus } from "@/hooks/useInterval";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar, meterTone } from "@/components/ui/ProgressBar";
import type { ReputationScore, ReputationGrade, ReputationTrend } from "@/types";

function gradeColor(grade: ReputationGrade): string {
  switch (grade) {
    case "A": return "text-flux-green";
    case "B": return "text-flux-cyan";
    case "C": return "text-flux-amber";
    case "D": return "text-flux-red";
    case "F": return "text-red-500";
  }
}

function gradeBg(grade: ReputationGrade): string {
  switch (grade) {
    case "A": return "bg-flux-green/10 border-flux-green/30";
    case "B": return "bg-flux-cyan/10 border-flux-cyan/30";
    case "C": return "bg-flux-amber/10 border-flux-amber/30";
    case "D": return "bg-flux-red/10 border-flux-red/30";
    case "F": return "bg-red-500/10 border-red-500/30";
  }
}

function TrendIcon({ trend }: { trend: ReputationTrend }) {
  if (trend === "improving") return <TrendingUp className="h-3.5 w-3.5 text-flux-green" />;
  if (trend === "declining") return <TrendingDown className="h-3.5 w-3.5 text-flux-red" />;
  return <Minus className="h-3.5 w-3.5 text-ink-muted" />;
}

export function ReputationPage() {
  const reputations = useAsync(() => api.getAllReputations(), []);
  const refreshAll = useCallback(() => { reputations.refresh(); }, [reputations]);
  useRefreshOnFocus(refreshAll);

  if (reputations.loading && !reputations.data) return <LoadingState label="Calculating reputations..." />;

  return (
    <>
      <PageHeader
        title="Agent Reputation"
        subtitle="Trust scores based on approval rate, compliance history, activity, and incidents."
      />

      {!reputations.data?.length ? (
        <Card className="p-6"><EmptyState icon={Shield} title="No agents" description="Register agents to see reputation scores." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {reputations.data.map((rep) => (
            <ReputationCard key={rep.agentId} rep={rep} />
          ))}
        </div>
      )}
    </>
  );
}

function ReputationCard({ rep }: { rep: ReputationScore }) {
  const b = rep.breakdown;
  return (
    <Card>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <Link to={`/agents/${rep.agentId}`} className="text-sm font-semibold text-ink hover:text-flux-cyan transition">
            {rep.agentName}
          </Link>
          <div className="flex items-center gap-2">
            <TrendIcon trend={rep.trend} />
            <span className={`rounded border px-2 py-0.5 text-lg font-bold ${gradeColor(rep.grade)} ${gradeBg(rep.grade)}`}>
              {rep.grade}
            </span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-2xl font-bold text-ink">{rep.score}</span>
          <span className="text-xs text-ink-muted">/ 100</span>
        </div>
        <ProgressBar percent={rep.score} tone={meterTone(rep.score > 75 ? 50 : rep.score > 50 ? 70 : 95)} className="mt-2" />

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded bg-bg-raised/50 p-2">
            <div className="text-ink-muted">Approval Rate</div>
            <div className="font-mono text-ink">{b.approvalRate.toFixed(1)}%</div>
          </div>
          <div className="rounded bg-bg-raised/50 p-2">
            <div className="text-ink-muted">Transactions</div>
            <div className="font-mono text-ink">{b.totalTransactions} ({b.rejectedTransactions} rejected)</div>
          </div>
          <div className="rounded bg-bg-raised/50 p-2">
            <div className="text-ink-muted">OOB Kills</div>
            <div className="font-mono text-ink">{b.oobKills}</div>
          </div>
          <div className="rounded bg-bg-raised/50 p-2">
            <div className="text-ink-muted">GC Reclaimed</div>
            <div className="font-mono text-ink">{b.gcReclamations}</div>
          </div>
        </div>
      </div>
    </Card>
  );
}
