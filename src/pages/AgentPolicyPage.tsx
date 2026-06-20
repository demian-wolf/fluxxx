import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/api";
import { useToast } from "@/context/ToastContext";
import { useAsync } from "@/hooks/useAsync";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/Spinner";
import { PolicyFields } from "@/components/domain/PolicyFields";
import {
  emptyPolicyValues,
  policyValuesToCents,
  type PolicyFormValues,
} from "@/lib/policy";
import { parseDomainList } from "@/lib/utils";

export function AgentPolicyPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const agent = useAsync(() => api.getAgent(id), [id]);
  const policy = useAsync(() => api.getActivePolicy(id), [id]);

  const [values, setValues] = useState<PolicyFormValues>(emptyPolicyValues);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (agent.data) {
      setValues({
        perTx: (agent.data.per_tx_limit_cents / 100).toFixed(2),
        hourly: (agent.data.hourly_limit_cents / 100).toFixed(2),
        daily: (agent.data.daily_limit_cents / 100).toFixed(2),
        allowed: agent.data.allowed_domains.join(", "),
        blocked: agent.data.blocked_domains.join(", "),
      });
    }
  }, [agent.data]);

  if (agent.loading || policy.loading) return <LoadingState />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const limits = policyValuesToCents(values);
      const next = await api.updatePolicy(id, {
        ...limits,
        allowed_domains: parseDomainList(values.allowed),
        blocked_domains: parseDomainList(values.blocked),
        require_description: policy.data?.rules.require_description ?? true,
        auto_suspend_on_anomaly: policy.data?.rules.auto_suspend_on_anomaly ?? true,
      });
      toast(
        "success",
        `Policy v${next.version} is now active`,
        "New policy takes effect on the next transaction request.",
      );
      navigate(`/agents/${id}`);
    } catch {
      toast("error", "Could not update policy");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Edit spend policy"
        crumbs={[
          { label: "Agents", to: "/agents" },
          { label: agent.data?.name ?? "Agent", to: `/agents/${id}` },
          { label: "Policy" },
        ]}
        subtitle={
          policy.data
            ? `Editing from policy v${policy.data.version}. Saving creates a new version.`
            : "Define the spending rules for this agent."
        }
      />

      <div className="mx-auto max-w-2xl">
        <Card>
          <CardBody>
            <form onSubmit={onSubmit} className="space-y-5">
              <PolicyFields values={values} onChange={setValues} />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => navigate(`/agents/${id}`)}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={submitting}>
                  Save policy
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
