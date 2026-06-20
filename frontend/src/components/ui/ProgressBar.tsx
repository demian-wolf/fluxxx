import { cn } from "@/lib/utils";

type Tone = "cyan" | "green" | "amber" | "red" | "violet";

const fills: Record<Tone, string> = {
  cyan: "from-flux-cyan to-flux-blue",
  green: "from-flux-green to-flux-cyan",
  amber: "from-flux-amber to-flux-red",
  red: "from-flux-red to-flux-red",
  violet: "from-flux-violet to-flux-cyan",
};

/** Picks a tone based on how close usage is to the limit. */
// eslint-disable-next-line react-refresh/only-export-components
export function meterTone(percent: number): Tone {
  if (percent >= 90) return "red";
  if (percent >= 70) return "amber";
  return "cyan";
}

export function ProgressBar({
  percent,
  tone = "cyan",
  className,
}: {
  percent: number;
  tone?: Tone;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-bg-raised",
        className,
      )}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          "h-full rounded-full bg-gradient-to-r transition-all duration-500",
          fills[tone],
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
