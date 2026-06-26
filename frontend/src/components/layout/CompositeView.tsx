import { useSearchParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { TabBar } from "@/components/ui/TabBar";

export interface CompositeTab {
  key: string;
  label: string;
  icon?: LucideIcon;
  Component: React.FC;
}

export function CompositeView({
  tabs,
  initialTab,
}: {
  tabs: CompositeTab[];
  initialTab?: string;
}) {
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get("tab");
  const active =
    tabs.find((t) => t.key === fromUrl)?.key ?? initialTab ?? tabs[0].key;
  const Content = (tabs.find((t) => t.key === active) ?? tabs[0]).Component;

  const setTab = (key: string) =>
    setParams(
      (prev) => {
        prev.set("tab", key);
        return prev;
      },
      { replace: true },
    );

  return (
    <>
      <TabBar tabs={tabs} active={active} onChange={setTab} />
      <div key={active} className="animate-fade-in">
        <Content />
      </div>
    </>
  );
}
