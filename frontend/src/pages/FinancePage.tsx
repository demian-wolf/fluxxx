import { useState } from "react";
import { CreditCard, Coins, Store, KeyRound } from "lucide-react";
import { TabBar } from "@/components/ui/TabBar";
import { BillingPage } from "./BillingPage";
import { CurrencyPage } from "./CurrencyPage";
import { ProvidersPage } from "./ProvidersPage";
import { LicensingPage } from "./LicensingPage";

const TABS = [
  { key: "billing", label: "Billing & Fees", icon: CreditCard },
  { key: "currency", label: "Multi-Currency", icon: Coins },
  { key: "providers", label: "Providers", icon: Store },
  { key: "licensing", label: "Licensing", icon: KeyRound },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const CONTENT: Record<TabKey, React.FC> = {
  billing: BillingPage,
  currency: CurrencyPage,
  providers: ProvidersPage,
  licensing: LicensingPage,
};

export function FinancePage({ initialTab }: { initialTab?: TabKey }) {
  const [tab, setTab] = useState<TabKey>(initialTab ?? "billing");
  const Content = CONTENT[tab];

  return (
    <>
      <TabBar tabs={TABS} active={tab} onChange={(k) => setTab(k as TabKey)} />
      <Content />
    </>
  );
}
