import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { api } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useLiveLedger } from "@/hooks/useLiveLedger";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { TransactionTable } from "@/components/domain/TransactionTable";
import { LoadingState, ErrorState } from "@/components/ui/Spinner";
import { domainOf, formatDateTime } from "@/lib/utils";
import type { TransactionRequest } from "@/types";

const typeOptions = [
  { value: "all", label: "All decisions" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function toCsv(rows: TransactionRequest[]): string {
  const header = [
    "time",
    "agent",
    "wallet",
    "amount_eur",
    "payee",
    "decision",
    "rejection_reason",
    "token",
  ];
  const lines = rows.map((t) =>
    [
      formatDateTime(t.created_at),
      t.agent_name,
      t.wallet_name,
      (t.requested_amount_cents / 100).toFixed(2),
      domainOf(t.payee_url),
      t.decision,
      t.rejection_reason ?? "",
      t.payment_token ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function TransactionsPage() {
  const agents = useAsync(() => api.listAgents(), []);
  const [type, setType] = useState("all");
  const [agentId, setAgentId] = useState("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");

  const txns = useAsync(
    () =>
      api.listTransactions({
        type: type as "all" | "approved" | "rejected",
        agentIds: agentId === "all" ? undefined : [agentId],
        search: search || undefined,
      }),
    [type, agentId, search],
  );
  useLiveLedger(txns.refresh);

  const rows = useMemo(() => {
    let list = txns.data ?? [];
    if (from) {
      const fromMs = new Date(from).getTime();
      list = list.filter((t) => new Date(t.created_at).getTime() >= fromMs);
    }
    return list;
  }, [txns.data, from]);

  const exportCsv = () => {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flux-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle="Full audit trail across all agents and wallets."
        actions={
          <Button variant="ghost" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-4 py-3">
          <div className="min-w-[180px] flex-1">
            <label className="label" htmlFor="transaction-search">
              Search
            </label>
            <Input
              id="transaction-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Payee, description, agent…"
            />
          </div>
          <div className="w-44">
            <label className="label" htmlFor="transaction-agent">
              Agent
            </label>
            <Select
              id="transaction-agent"
              options={[
                { value: "all", label: "All agents" },
                ...(agents.data ?? []).map((a) => ({ value: a.id, label: a.name })),
              ]}
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
            />
          </div>
          <div className="w-40">
            <label className="label" htmlFor="transaction-decision">
              Decision
            </label>
            <Select
              id="transaction-decision"
              options={typeOptions}
              value={type}
              onChange={(e) => setType(e.target.value)}
            />
          </div>
          <div className="w-44">
            <label className="label" htmlFor="transaction-from-date">
              From date
            </label>
            <input
              id="transaction-from-date"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="input"
            />
          </div>
        </div>

        {txns.loading ? (
          <LoadingState />
        ) : txns.error ? (
          <ErrorState message={txns.error} onRetry={txns.refresh} />
        ) : (
          <TransactionTable
            rows={rows}
            emptyLabel="No transactions match these filters."
          />
        )}
      </Card>
    </>
  );
}
