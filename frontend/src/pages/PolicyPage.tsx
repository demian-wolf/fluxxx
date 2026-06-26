import { Puzzle, ShieldCheck, Shield } from "lucide-react";
import { CompositeView } from "@/components/layout/CompositeView";
import { PluginsPage } from "./PluginsPage";
import { AgentAccessPage } from "./AgentAccessPage";
import { ReputationPage } from "./ReputationPage";

export function PolicyPage({ initialTab }: { initialTab?: string }) {
  return (
    <CompositeView
      initialTab={initialTab}
      tabs={[
        { key: "plugins", label: "Policy Plugins", icon: Puzzle, Component: PluginsPage },
        { key: "access", label: "Wallet Access", icon: ShieldCheck, Component: AgentAccessPage },
        { key: "reputation", label: "Reputation", icon: Shield, Component: ReputationPage },
      ]}
    />
  );
}
