import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Plus, Wallet } from "lucide-react";
import { api } from "@/api";
import { useWallets } from "@/context/WalletContext";
import { useToast } from "@/context/ToastContext";
import { useAsync } from "@/hooks/useAsync";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input } from "@/components/ui/Input";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { WalletStatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState, ErrorState } from "@/components/ui/Spinner";
import { formatCents, formatDateTime } from "@/lib/utils";
import type { AgentWallet } from "@/types";

export function WalletsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refresh: refreshContext } = useWallets();
  const wallets = useAsync(() => api.listWallets(), []);
  const agents = useAsync(() => api.listAgents(), []);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const agentCountFor = (walletId: string) =>
    (agents.data ?? []).filter((a) => a.wallet_id === walletId).length;

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const wallet = await api.createWallet({ name: name.trim() });
      toast("success", "Wallet created", `${wallet.name} is ready to fund.`);
      setModalOpen(false);
      setName("");
      wallets.refresh();
      refreshContext();
    } catch {
      toast("error", "Could not create wallet");
    } finally {
      setCreating(false);
    }
  };

  const columns: Column<AgentWallet>[] = [
    {
      key: "name",
      header: "Wallet",
      render: (w) => <span className="font-medium text-ink">{w.name}</span>,
    },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      render: (w) => (
        <span className="font-mono text-ink">{formatCents(w.balance_cents)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (w) => <WalletStatusBadge status={w.status} />,
    },
    {
      key: "agents",
      header: "Agents",
      align: "right",
      render: (w) => (
        <span className="font-mono text-ink-muted">{agentCountFor(w.id)}</span>
      ),
    },
    {
      key: "created",
      header: "Created",
      render: (w) => (
        <span className="text-ink-muted">{formatDateTime(w.created_at)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: () => (
        <span className="inline-flex items-center gap-1 text-flux-cyan">
          <Eye className="h-4 w-4" /> View
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Wallets"
        subtitle="Funded accounts that back your agents."
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Create Wallet
          </Button>
        }
      />

      <Card>
        {wallets.loading ? (
          <LoadingState />
        ) : wallets.error ? (
          <ErrorState message={wallets.error} onRetry={wallets.refresh} />
        ) : wallets.data && wallets.data.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No wallets yet"
            description="Create a wallet to start funding agents."
            action={
              <Button onClick={() => setModalOpen(true)} className="mt-1">
                <Plus className="h-4 w-4" /> Create Wallet
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            rows={wallets.data ?? []}
            rowKey={(w) => w.id}
            onRowClick={(w) => navigate(`/wallets/${w.id}`)}
          />
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create new wallet"
        description="Give your wallet a recognizable name. You can fund it next."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onCreate} loading={creating}>
              Create wallet
            </Button>
          </>
        }
      >
        <form onSubmit={onCreate}>
          <Field label="Wallet name">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Research Budget Q3"
            />
          </Field>
        </form>
      </Modal>
    </>
  );
}
