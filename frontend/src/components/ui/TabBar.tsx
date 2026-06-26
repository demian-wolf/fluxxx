import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Tab {
  key: string;
  label: string;
  icon?: LucideIcon;
}

export function TabBar<T extends Tab>({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly T[];
  active: string;
  onChange: (key: T["key"]) => void;
}) {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-line bg-bg-soft/60 p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition",
              isActive
                ? "bg-bg-raised text-ink shadow-sm"
                : "text-ink-muted hover:bg-bg-raised/50 hover:text-ink",
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
