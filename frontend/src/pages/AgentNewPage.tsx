import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, TriangleAlert } from "lucide-react";
import { api } from "@/api";
import { useToast } from "@/context/ToastContext";
import { useAsync } from "@/hooks/useAsync";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { CopyButton } from "@/components/ui/CopyButton";
import { LoadingState } from "@/components/ui/Spinner";
import { PolicyFields } from "@/components/domain/PolicyFields";
import {
  emptyPolicyValues,
  policyValuesToCents,
  type PolicyFormValues,
} from "@/lib/policy";
import { parseDomainList, formatCents } from "@/lib/utils";
import type { RegisterAgentResponse } from "@/types";

export function AgentNewPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const wallets = useAsync(() => api.listWallets(), []);
  const agents = useAsync(() => api.listAgents(), []);

  const [name, setName] = useState("");
  const [walletId, setWalletId] = useState(params.get("wallet") ?? "");
  const [parentId, setParentId] = useState(params.get("parent") ?? "");
  const [policy, setPolicy] = useState<PolicyFormValues>(emptyPolicyValues);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<RegisterAgentResponse | null>(null);

  if (wallets.loading) return <LoadingState />;

  const walletOptions = (wallets.data ?? []).map((w) => ({
    value: w.id,
    label: `${w.name} (${formatCents(w.balance_cents)})`,
  }));
  const effectiveWalletId = walletId || walletOptions[0]?.value || "";

  // A child agent must live in the same wallet as its parent, so only offer
  // agents from the selected wallet as parents.
  const parentOptions = [
    { value: "", label: "— None (root agent) —" },
    ...(agents.data ?? [])
      .filter((a) => a.wallet_id === effectiveWalletId)
      .map((a) => ({ value: a.id, label: a.name })),
  ];
  const effectiveParentId = parentOptions.some((o) => o.value === parentId)
    ? parentId
    : "";

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !effectiveWalletId) {
      toast("error", "Name and wallet are required");
      return;
    }
    setSubmitting(true);
    try {
      const limits = policyValuesToCents(policy);
      const res = await api.registerAgent({
        wallet_id: effectiveWalletId,
        parent_id: effectiveParentId || null,
        name: name.trim(),
        ...limits,
        allowed_domains: parseDomainList(policy.allowed),
        blocked_domains: parseDomainList(policy.blocked),
      });
      setCreated(res);
    } catch {
      toast("error", "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Register agent"
        crumbs={[{ label: "Agents", to: "/agents" }, { label: "New" }]}
        subtitle="The Know Your Agent form — where a new AI agent gets its identity."
      />

      <div className="mx-auto max-w-2xl">
        <Card>
          <CardBody>
            <form onSubmit={onSubmit} className="space-y-5">
              <Field label="Agent name">
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ResearchBot v1"
                />
              </Field>

              <Field label="Assign to wallet">
                <Select
                  options={walletOptions}
                  value={effectiveWalletId}
                  onChange={(e) => {
                    setWalletId(e.target.value);
                    setParentId("");
                  }}
                />
              </Field>

              <Field
                label="Parent agent"
                hint="Optional. Nest this agent under a parent to form a spend tree; suspending the parent cascades to this agent."
              >
                <Select
                  options={parentOptions}
                  value={effectiveParentId}
                  onChange={(e) => setParentId(e.target.value)}
                />
              </Field>

              <PolicyFields values={policy} onChange={setPolicy} />

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" type="button" onClick={() => navigate("/agents")}>
                  Cancel
                </Button>
                <Button type="submit" loading={submitting}>
                  Register Agent
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>

      <Modal
        open={!!created}
        onClose={() => {}}
        dismissable={false}
        size="md"
        title={
          <span className="flex items-center gap-2">
            <TriangleAlert className="h-5 w-5 text-flux-amber" /> Your Agent API
            Key
          </span>
        }
        description="This key will NOT be shown again. Store it securely in your agent's environment variables."
        footer={
          <Button
            onClick={() => created && navigate(`/agents/${created.agent.id}`)}
          >
            I&apos;ve saved it — Continue
          </Button>
        }
      >
        <div className="rounded-lg border border-flux-amber/30 bg-flux-amber/5 p-4">
          <div className="flex items-center gap-2 text-flux-amber">
            <KeyRound className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Secret key
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 break-all rounded-md bg-bg px-3 py-2 font-mono text-sm text-ink">
              {created?.api_key}
            </code>
            <CopyButton value={created?.api_key ?? ""} label="Copy" />
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          FLUX stores only a hash of this key. If you lose it, you&apos;ll need
          to rotate the agent&apos;s credentials.
        </p>
      </Modal>
    </>
  );
}
