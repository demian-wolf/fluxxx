import { useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  Radio,
  XCircle,
} from "lucide-react";
import type { LedgerEntry, TransactionRequest } from "@/types";
import { api } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useLiveLedger } from "@/hooks/useLiveLedger";
import { Card, CardHeader } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/Spinner";
import { cn, domainOf, formatCents, formatTime } from "@/lib/utils";

type FeedItem =
  | { kind: "tx"; id: string; at: string; tx: TransactionRequest }
  | { kind: "deposit"; id: string; at: string; entry: LedgerEntry };

export function LiveFeed({ walletId }: { walletId: string }) {
  const navigate = useNavigate();
  const seen = useRef<Set<string>>(new Set());

  const txs = useAsync(
    () => api.listTransactions({ walletId }),
    [walletId],
  );
  const ledger = useAsync(() => api.listLedger(walletId), [walletId]);

  const refresh = useCallback(() => {
    txs.refresh();
    ledger.refresh();
  }, [txs, ledger]);
  useLiveLedger(refresh);

  const items = useMemo<FeedItem[]>(() => {
    const txItems: FeedItem[] = (txs.data ?? []).map((tx) => ({
      kind: "tx",
      id: tx.id,
      at: tx.created_at,
      tx,
    }));
    const depositItems: FeedItem[] = (ledger.data ?? [])
      .filter((e) => e.type === "deposit")
      .map((entry) => ({ kind: "deposit", id: entry.id, at: entry.created_at, entry }));
    return [...txItems, ...depositItems]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 14);
  }, [txs.data, ledger.data]);

  const loading = txs.loading && ledger.loading;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Live Ledger"
        right={
          <span className="flex items-center gap-1.5 text-xs font-medium text-flux-green">
            <Radio className="h-3.5 w-3.5 animate-pulse-dot" /> streaming
          </span>
        }
      />
      <div className="min-h-[360px] flex-1 overflow-y-auto">
        {loading ? (
          <LoadingState label="Connecting to ledger…" />
        ) : (
          <ul>
            {items.map((item) => {
              const isNew = !seen.current.has(item.id);
              if (isNew) seen.current.add(item.id);
              return (
                <FeedRow
                  key={item.id}
                  item={item}
                  isNew={isNew}
                  onClick={() =>
                    item.kind === "tx" &&
                    navigate(`/transactions/${item.tx.id}`)
                  }
                />
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

function FeedRow({
  item,
  isNew,
  onClick,
}: {
  item: FeedItem;
  isNew: boolean;
  onClick: () => void;
}) {
  const base =
    "flex items-center gap-3 border-b border-line/50 px-4 py-2.5 text-sm last:border-0";

  if (item.kind === "deposit") {
    const e = item.entry;
    return (
      <li className={cn(base, isNew && "animate-row-in")}>
        <ArrowDownToLine className="h-4 w-4 shrink-0 text-flux-blue" />
        <span className="w-16 shrink-0 font-mono text-xs text-ink-muted">
          {formatTime(e.created_at)}
        </span>
        <span className="flex-1 truncate text-ink">Deposit</span>
        <span className="font-mono font-medium text-flux-green">
          +{formatCents(e.amount_cents)}
        </span>
        <span className="w-24 shrink-0 truncate text-right text-xs text-ink-muted">
          {e.description.replace("Wallet top-up via ", "")}
        </span>
      </li>
    );
  }

  const tx = item.tx;
  const approved = tx.decision === "approved";
  const rejected = tx.decision === "rejected";

  return (
    <li
      onClick={onClick}
      className={cn(
        base,
        "cursor-pointer transition hover:bg-bg-raised/50",
        isNew && "animate-row-in",
      )}
    >
      {approved ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-flux-green" />
      ) : rejected ? (
        <XCircle className="h-4 w-4 shrink-0 text-flux-red" />
      ) : (
        <Clock className="h-4 w-4 shrink-0 text-flux-amber" />
      )}
      <span className="w-16 shrink-0 font-mono text-xs text-ink-muted">
        {formatTime(tx.created_at)}
      </span>
      <span className="flex-1 truncate text-ink">{tx.agent_name}</span>
      {approved ? (
        <span className="font-mono font-medium text-ink">
          -{formatCents(tx.requested_amount_cents)}
        </span>
      ) : rejected ? (
        <span className="text-xs font-semibold uppercase text-flux-red">
          rejected
        </span>
      ) : (
        <span className="text-xs font-semibold uppercase text-flux-amber">
          pending
        </span>
      )}
      <span className="w-24 shrink-0 truncate text-right text-xs text-ink-muted">
        {rejected ? tx.rejection_reason : domainOf(tx.payee_url)}
      </span>
    </li>
  );
}
