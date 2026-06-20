import {
  ArrowDownToLine,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  RotateCcw,
  XCircle,
} from "lucide-react";
import type { LedgerEntry, LedgerType } from "@/types";
import { cn, formatCents } from "@/lib/utils";

// eslint-disable-next-line react-refresh/only-export-components
export function ledgerSign(type: LedgerType): "+" | "-" | "" {
  if (type === "deposit" || type === "refund" || type === "release") return "+";
  if (type === "spend" || type === "hold") return "-";
  return "";
}

export function LedgerAmount({ entry }: { entry: LedgerEntry }) {
  const sign = ledgerSign(entry.type);
  const positive = sign === "+";
  return (
    <span
      className={cn(
        "font-mono font-medium",
        positive ? "text-flux-green" : "text-ink",
      )}
    >
      {sign}
      {formatCents(entry.amount_cents)}
    </span>
  );
}

export function LedgerTypeIcon({ entry }: { entry: LedgerEntry }) {
  if (entry.type === "deposit")
    return <ArrowDownToLine className="h-4 w-4 text-flux-blue" />;
  if (entry.type === "refund" || entry.type === "release")
    return <RotateCcw className="h-4 w-4 text-flux-green" />;
  if (entry.status === "pending")
    return <Clock className="h-4 w-4 text-flux-amber" />;
  if (entry.status === "failed" || entry.status === "reversed")
    return <XCircle className="h-4 w-4 text-flux-red" />;
  return <CheckCircle2 className="h-4 w-4 text-flux-green" />;
}

export function PayeeLink({ url }: { url: string | null }) {
  if (!url) return <span className="text-ink-faint">—</span>;
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* keep raw */
  }
  return (
    <span className="inline-flex items-center gap-1 text-ink-muted">
      <ArrowUpRight className="h-3 w-3" />
      {host}
    </span>
  );
}
