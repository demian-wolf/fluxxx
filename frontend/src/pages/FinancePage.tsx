import { CreditCard, Coins, Store, KeyRound } from "lucide-react";
import { CompositeView } from "@/components/layout/CompositeView";
import { BillingPage } from "./BillingPage";
import { CurrencyPage } from "./CurrencyPage";
import { ProvidersPage } from "./ProvidersPage";
import { LicensingPage } from "./LicensingPage";

export function FinancePage({ initialTab }: { initialTab?: string }) {
  return (
    <CompositeView
      initialTab={initialTab}
      tabs={[
        { key: "billing", label: "Billing & Fees", icon: CreditCard, Component: BillingPage },
        { key: "currency", label: "Multi-Currency", icon: Coins, Component: CurrencyPage },
        { key: "providers", label: "Providers", icon: Store, Component: ProvidersPage },
        { key: "licensing", label: "Licensing", icon: KeyRound, Component: LicensingPage },
      ]}
    />
  );
}
