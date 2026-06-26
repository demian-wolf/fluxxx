import { useState } from "react";
import { Zap, Bell } from "lucide-react";
import { TabBar } from "@/components/ui/TabBar";
import { DevinPage } from "./DevinPage";
import { WebhooksPage } from "./WebhooksPage";

const TABS = [
  { key: "devin", label: "Devin", icon: Zap },
  { key: "webhooks", label: "Webhooks", icon: Bell },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const CONTENT: Record<TabKey, React.FC> = {
  devin: DevinPage,
  webhooks: WebhooksPage,
};

export function IntegrationsPage({ initialTab }: { initialTab?: TabKey }) {
  const [tab, setTab] = useState<TabKey>(initialTab ?? "devin");
  const Content = CONTENT[tab];

  return (
    <>
      <TabBar tabs={TABS} active={tab} onChange={(k) => setTab(k as TabKey)} />
      <Content />
    </>
  );
}
