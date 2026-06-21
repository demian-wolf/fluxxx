import { useCallback, useState } from "react";
import { Bell, Trash2, Plus, CheckCircle, XCircle, Send } from "lucide-react";
import { api } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useRefreshOnFocus } from "@/hooks/useInterval";
import { useToast } from "@/context/ToastContext";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { relativeTime } from "@/lib/utils";
import type { AlertEventType, WebhookConfig, AlertDelivery } from "@/types";

const ALL_EVENTS: AlertEventType[] = [
  "oob_kill", "gc_sweep", "policy_violation", "low_balance",
  "agent_spawned", "high_value_approval", "agent_revoked", "approval_required",
];

export function WebhooksPage() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [newEvents, setNewEvents] = useState<AlertEventType[]>(["oob_kill", "low_balance"]);
  const [adding, setAdding] = useState(false);

  const webhooks = useAsync(() => api.listWebhooks(), []);
  const deliveries = useAsync(() => api.getDeliveryLog(20), []);

  const refreshAll = useCallback(() => {
    webhooks.refresh();
    deliveries.refresh();
  }, [webhooks, deliveries]);

  useRefreshOnFocus(refreshAll);

  const handleAdd = async () => {
    if (!newUrl) return;
    setAdding(true);
    try {
      await api.createWebhook(newUrl, newEvents, newSecret || undefined);
      toast("success", "Webhook registered");
      setShowAdd(false);
      setNewUrl("");
      setNewSecret("");
      refreshAll();
    } catch {
      toast("error", "Failed to register webhook");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteWebhook(id);
      toast("success", "Webhook removed");
      refreshAll();
    } catch {
      toast("error", "Failed to remove webhook");
    }
  };

  const toggleEvent = (ev: AlertEventType) => {
    setNewEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev],
    );
  };

  return (
    <>
      <PageHeader
        title="Webhooks & Alerts"
        subtitle="Push event notifications to external endpoints (Slack, PagerDuty, custom)."
        actions={
          <Button variant="primary" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-4 w-4" /> Add Webhook
          </Button>
        }
      />

      {showAdd && (
        <Card className="mb-6">
          <div className="p-4 space-y-3">
            <Field label="Webhook URL">
              <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://hooks.slack.com/services/..." />
            </Field>
            <Field label="Secret (optional)">
              <Input value={newSecret} onChange={(e) => setNewSecret(e.target.value)} placeholder="whsec_..." />
            </Field>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">Events</label>
              <div className="flex flex-wrap gap-2">
                {ALL_EVENTS.map((ev) => (
                  <button
                    key={ev}
                    onClick={() => toggleEvent(ev)}
                    className={`rounded-md border px-2.5 py-1 text-xs transition ${
                      newEvents.includes(ev)
                        ? "border-flux-cyan bg-flux-cyan/10 text-flux-cyan"
                        : "border-line text-ink-muted hover:border-flux-cyan/40"
                    }`}
                  >
                    {ev.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleAdd} loading={adding}>Register</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Registered Webhooks" subtitle="Endpoints receiving event notifications" />
          <div className="p-0">
            {webhooks.loading && !webhooks.data ? (
              <div className="p-6"><LoadingState /></div>
            ) : !webhooks.data?.length ? (
              <div className="p-6"><EmptyState icon={Bell} title="No webhooks" description="Register a webhook to receive real-time alerts." /></div>
            ) : (
              <div className="divide-y divide-line">
                {webhooks.data.map((wh) => (
                  <WebhookRow key={wh.id} webhook={wh} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent Deliveries" subtitle="Delivery history for dispatched alerts" />
          <div className="p-0">
            {deliveries.loading && !deliveries.data ? (
              <div className="p-6"><LoadingState /></div>
            ) : !deliveries.data?.length ? (
              <div className="p-6"><EmptyState icon={Send} title="No deliveries yet" description="Deliveries will appear here as events fire." /></div>
            ) : (
              <div className="divide-y divide-line">
                {deliveries.data.map((d, i) => (
                  <DeliveryRow key={i} delivery={d} />
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

function WebhookRow({ webhook, onDelete }: { webhook: WebhookConfig; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-mono text-ink">{webhook.url}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {webhook.events.map((ev) => (
            <Badge key={ev} tone="cyan" className="text-[10px]">{ev.replace(/_/g, " ")}</Badge>
          ))}
        </div>
      </div>
      <Button variant="ghost" onClick={() => onDelete(webhook.id)} className="!text-flux-red">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function DeliveryRow({ delivery }: { delivery: AlertDelivery }) {
  const isOk = delivery.status === "delivered";
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-xs">
      {isOk ? <CheckCircle className="h-3.5 w-3.5 text-flux-green" /> : <XCircle className="h-3.5 w-3.5 text-flux-red" />}
      <span className="font-medium text-ink">{delivery.eventType.replace(/_/g, " ")}</span>
      <span className="text-ink-muted">{delivery.statusCode ?? delivery.error}</span>
      <span className="ml-auto text-ink-faint">{relativeTime(delivery.attemptedAt)}</span>
    </div>
  );
}
