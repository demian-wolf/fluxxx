import { useState } from "react";
import { ShieldAlert, Recycle, TrendingDown, CheckCircle } from "lucide-react";
import { TabBar } from "@/components/ui/TabBar";
import { OobPage } from "./OobPage";
import { GcPage } from "./GcPage";
import { ForecastPage } from "./ForecastPage";
import { ApprovalPage } from "./ApprovalPage";

const TABS = [
  { key: "oob", label: "OOB Killer", icon: ShieldAlert },
  { key: "gc", label: "Capital Reclamation", icon: Recycle },
  { key: "forecast", label: "Forecasting", icon: TrendingDown },
  { key: "approval", label: "Approval Queue", icon: CheckCircle },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const CONTENT: Record<TabKey, React.FC> = {
  oob: OobPage,
  gc: GcPage,
  forecast: ForecastPage,
  approval: ApprovalPage,
};

export function GovernancePage({ initialTab }: { initialTab?: TabKey }) {
  const [tab, setTab] = useState<TabKey>(initialTab ?? "oob");
  const Content = CONTENT[tab];

  return (
    <>
      <TabBar tabs={TABS} active={tab} onChange={(k) => setTab(k as TabKey)} />
      <Content />
    </>
  );
}
