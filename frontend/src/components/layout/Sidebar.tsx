import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  Bot,
  ReceiptText,
  Recycle,
  ShieldAlert,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { Wordmark } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { IS_MOCK } from "@/api";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const items: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/wallets", label: "Wallets", icon: Wallet },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/transactions", label: "Transactions", icon: ReceiptText },
  { to: "/gc", label: "Capital Reclamation", icon: Recycle },
  { to: "/oob", label: "OOB Killer", icon: ShieldAlert },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Wordmark />
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                isActive
                  ? "bg-flux-cyan/10 text-ink shadow-[inset_2px_0_0_0_#22d3ee]"
                  : "text-ink-muted hover:bg-bg-raised/60 hover:text-ink",
              )
            }
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-4">
        <div className="rounded-lg border border-line bg-bg-raised/50 p-3">
          <p className="text-xs font-semibold text-ink">
            {IS_MOCK ? "Demo mode" : "Live backend"}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-ink-muted">
            {IS_MOCK
              ? "Running on an in-memory simulation of the FLUX backend."
              : "Connected to a live FLUX deployment."}
          </p>
        </div>
      </div>
    </div>
  );
}
