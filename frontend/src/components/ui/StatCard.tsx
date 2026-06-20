import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "cyan",
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: ReactNode;
  tone?: "cyan" | "green" | "violet" | "amber" | "red";
  className?: string;
}) {
  const toneClass = {
    cyan: "text-flux-cyan",
    green: "text-flux-green",
    violet: "text-flux-violet",
    amber: "text-flux-amber",
    red: "text-flux-red",
  }[tone];

  return (
    <div className={cn("card p-4", className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          {label}
        </p>
        {Icon && <Icon className={cn("h-4 w-4", toneClass)} />}
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-ink">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
