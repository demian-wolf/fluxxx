import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone =
  | "green"
  | "amber"
  | "red"
  | "blue"
  | "cyan"
  | "violet"
  | "neutral";

const tones: Record<BadgeTone, string> = {
  green: "bg-flux-green/12 text-flux-green border-flux-green/25",
  amber: "bg-flux-amber/12 text-flux-amber border-flux-amber/25",
  red: "bg-flux-red/12 text-flux-red border-flux-red/25",
  blue: "bg-flux-blue/12 text-flux-blue border-flux-blue/25",
  cyan: "bg-flux-cyan/12 text-flux-cyan border-flux-cyan/25",
  violet: "bg-flux-violet/12 text-flux-violet border-flux-violet/25",
  neutral: "bg-ink/5 text-ink-muted border-line",
};

export function Badge({
  tone = "neutral",
  children,
  dot,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {dot && (
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      )}
      {children}
    </span>
  );
}
