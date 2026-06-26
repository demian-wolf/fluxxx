import { useState } from "react";
import { Wallet, Bot } from "lucide-react";
import { TabBar } from "@/components/ui/TabBar";
import { WalletsPage } from "./WalletsPage";
import { AgentsPage } from "./AgentsPage";

const TABS = [
  { key: "wallets", label: "Wallets", icon: Wallet },
  { key: "agents", label: "Agents", icon: Bot },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const CONTENT: Record<TabKey, React.FC> = {
  wallets: WalletsPage,
  agents: AgentsPage,
};

export function AssetsPage({ initialTab }: { initialTab?: TabKey }) {
  const [tab, setTab] = useState<TabKey>(initialTab ?? "wallets");
  const Content = CONTENT[tab];

  return (
    <>
      <TabBar tabs={TABS} active={tab} onChange={(k) => setTab(k as TabKey)} />
      <Content />
    </>
  );
}
