import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LedgerEntry } from "@/types";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Select, type SelectOption } from "@/components/ui/Select";
import { LedgerStatusBadge } from "@/components/ui/StatusBadge";
import { LedgerAmount, LedgerTypeIcon, PayeeLink } from "./ledger";
import { cn, formatTime, shortId } from "@/lib/utils";

const PAGE_SIZE = 50;

const typeOptions: SelectOption[] = [
  { value: "all", label: "All types" },
  { value: "deposit", label: "Deposits" },
  { value: "spend", label: "Spend" },
  { value: "refund", label: "Refunds" },
];

export function LedgerTable({
  entries,
  agentOptions,
}: {
  entries: LedgerEntry[];
  agentOptions: SelectOption[];
}) {
  const [type, setType] = useState("all");
  const [agent, setAgent] = useState("all");
  const [from, setFrom] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (type !== "all" && e.type !== type) return false;
      if (agent !== "all" && e.agent_id !== agent) return false;
      if (from) {
        const fromMs = new Date(from).getTime();
        if (new Date(e.created_at).getTime() < fromMs) return false;
      }
      return true;
    });
  }, [entries, type, agent, from]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const columns: Column<LedgerEntry>[] = [
    {
      key: "time",
      header: "Time",
      render: (e) => (
        <span className="flex items-center gap-2">
          <LedgerTypeIcon entry={e} />
          <span className="font-mono text-xs text-ink-muted">
            {formatTime(e.created_at)}
          </span>
        </span>
      ),
    },
    {
      key: "agent",
      header: "Agent",
      render: (e) => (
        <span className="text-ink">{e.agent_name ?? "—"}</span>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (e) => <span className="capitalize text-ink-muted">{e.type}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (e) => <LedgerAmount entry={e} />,
    },
    {
      key: "payee",
      header: "Payee",
      render: (e) => <PayeeLink url={e.payee_url} />,
    },
    {
      key: "status",
      header: "Status",
      render: (e) => <LedgerStatusBadge status={e.status} />,
    },
    {
      key: "token",
      header: "Token",
      render: (e) =>
        e.payment_token ? (
          <span className="font-mono text-xs text-ink-faint">
            {shortId(e.payment_token, 14)}
          </span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 border-b border-line px-4 py-3">
        <div className="w-40">
          <label className="label">Type</label>
          <Select
            options={typeOptions}
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <div className="w-48">
          <label className="label">Agent</label>
          <Select
            options={[{ value: "all", label: "All agents" }, ...agentOptions]}
            value={agent}
            onChange={(e) => {
              setAgent(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <div className="w-44">
          <label className="label">From date</label>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(0);
            }}
            className="input"
          />
        </div>
        <p className="ml-auto text-xs text-ink-muted">
          {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(e) => e.id}
        emptyState={
          <p className="py-10 text-center text-sm text-ink-muted">
            No ledger entries match these filters.
          </p>
        }
      />

      {pageCount > 1 && (
        <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
          <span className="text-ink-muted">
            Page {safePage + 1} of {pageCount}
          </span>
          <div className="flex gap-2">
            <button
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className={cn(
                "btn-ghost !px-2.5 !py-1.5",
                safePage === 0 && "opacity-40",
              )}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <button
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className={cn(
                "btn-ghost !px-2.5 !py-1.5",
                safePage >= pageCount - 1 && "opacity-40",
              )}
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
