import { ShieldAlert, Recycle, TrendingDown, CheckCircle } from "lucide-react";
import { CompositeView } from "@/components/layout/CompositeView";
import { OobPage } from "./OobPage";
import { GcPage } from "./GcPage";
import { ForecastPage } from "./ForecastPage";
import { ApprovalPage } from "./ApprovalPage";

export function GovernancePage({ initialTab }: { initialTab?: string }) {
  return (
    <CompositeView
      initialTab={initialTab}
      tabs={[
        { key: "oob", label: "OOB Killer", icon: ShieldAlert, Component: OobPage },
        { key: "gc", label: "Capital Reclamation", icon: Recycle, Component: GcPage },
        { key: "forecast", label: "Forecasting", icon: TrendingDown, Component: ForecastPage },
        { key: "approval", label: "Approval Queue", icon: CheckCircle, Component: ApprovalPage },
      ]}
    />
  );
}
