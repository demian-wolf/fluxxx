import { useState } from "react";
import { Puzzle, ShieldCheck, Shield } from "lucide-react";
import { TabBar } from "@/components/ui/TabBar";
import { PluginsPage } from "./PluginsPage";
import { AgentAccessPage } from "./AgentAccessPage";
import { ReputationPage } from "./ReputationPage";

const TABS = [
  { key: "plugins", label: "Policy Plugins", icon: Puzzle },
  { key: "access", label: "Wallet Access", icon: ShieldCheck },
  { key: "reputation", label: "Reputation", icon: Shield },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const CONTENT: Record<TabKey, React.FC> = {
  plugins: PluginsPage,
  access: AgentAccessPage,
  reputation: ReputationPage,
};

export function PolicyPage({ initialTab }: { initialTab?: TabKey }) {
  const [tab, setTab] = useState<TabKey>(initialTab ?? "plugins");
  const Content = CONTENT[tab];

  return (
    <>
      <TabBar tabs={TABS} active={tab} onChange={(k) => setTab(k as TabKey)} />
      <Content />
    </>
  );
}
