import { Zap, Bell } from "lucide-react";
import { CompositeView } from "@/components/layout/CompositeView";
import { DevinPage } from "./DevinPage";
import { WebhooksPage } from "./WebhooksPage";

export function IntegrationsPage({ initialTab }: { initialTab?: string }) {
  return (
    <CompositeView
      initialTab={initialTab}
      tabs={[
        { key: "devin", label: "Devin", icon: Zap, Component: DevinPage },
        { key: "webhooks", label: "Webhooks", icon: Bell, Component: WebhooksPage },
      ]}
    />
  );
}
