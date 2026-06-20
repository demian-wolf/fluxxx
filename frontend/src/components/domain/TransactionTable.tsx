import { useNavigate } from "react-router-dom";
import type { TransactionRequest } from "@/types";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { DecisionBadge } from "@/components/ui/StatusBadge";
import { PayeeLink } from "./ledger";
import { formatTime, formatCents, shortId } from "@/lib/utils";

export function TransactionTable({
  rows,
  showAgent = true,
  showWallet = true,
  emptyLabel = "No transactions yet.",
}: {
  rows: TransactionRequest[];
  showAgent?: boolean;
  showWallet?: boolean;
  emptyLabel?: string;
}) {
  const navigate = useNavigate();

  const columns: Column<TransactionRequest>[] = [
    {
      key: "time",
      header: "Time",
      render: (t) => (
        <span className="font-mono text-xs text-ink-muted">
          {formatTime(t.created_at)}
        </span>
      ),
    },
    ...(showAgent
      ? [
          {
            key: "agent",
            header: "Agent",
            render: (t: TransactionRequest) => (
              <span className="text-ink">{t.agent_name}</span>
            ),
          } satisfies Column<TransactionRequest>,
        ]
      : []),
    ...(showWallet
      ? [
          {
            key: "wallet",
            header: "Wallet",
            render: (t: TransactionRequest) => (
              <span className="text-ink-muted">{t.wallet_name}</span>
            ),
          } satisfies Column<TransactionRequest>,
        ]
      : []),
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (t) => (
        <span className="font-mono text-ink">
          {formatCents(t.requested_amount_cents)}
        </span>
      ),
    },
    {
      key: "payee",
      header: "Payee",
      render: (t) => <PayeeLink url={t.payee_url} />,
    },
    {
      key: "decision",
      header: "Decision",
      render: (t) => <DecisionBadge decision={t.decision} />,
    },
    {
      key: "token",
      header: "Token",
      render: (t) =>
        t.payment_token ? (
          <span className="font-mono text-xs text-ink-faint">
            {shortId(t.payment_token, 14)}
          </span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(t) => t.id}
      onRowClick={(t) => navigate(`/transactions/${t.id}`)}
      emptyState={
        <p className="py-10 text-center text-sm text-ink-muted">{emptyLabel}</p>
      }
    />
  );
}
