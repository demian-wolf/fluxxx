import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="rounded-full border border-line bg-bg-raised/60 p-3">
        <Icon className="h-6 w-6 text-ink-muted" />
      </div>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description && (
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
