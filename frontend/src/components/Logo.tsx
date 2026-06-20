import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden>
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#22d3ee" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="#0e1320" stroke="#1e2740" />
      <path
        d="M11 7h12l-2.2 4H13v3h6l-2.2 4H13v7h-4z"
        fill="url(#logoGrad)"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LogoMark />
      <div className="leading-none">
        <span className="bg-gradient-to-r from-flux-cyan to-flux-violet bg-clip-text text-lg font-bold tracking-tight text-transparent">
          FLUX
        </span>
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-faint">
          Commerce Gateway
        </p>
      </div>
    </div>
  );
}
