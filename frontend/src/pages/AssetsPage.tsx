import { Wallet, Bot } from "lucide-react";
import { CompositeView } from "@/components/layout/CompositeView";
import { WalletsPage } from "./WalletsPage";
import { AgentsPage } from "./AgentsPage";

export function AssetsPage({ initialTab }: { initialTab?: string }) {
  return (
    <CompositeView
      initialTab={initialTab}
      tabs={[
        { key: "wallets", label: "Wallets", icon: Wallet, Component: WalletsPage },
        { key: "agents", label: "Agents", icon: Bot, Component: AgentsPage },
      ]}
    />
  );
}
