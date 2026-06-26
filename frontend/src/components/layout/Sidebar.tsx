import { NavLink, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  Bot,
  ReceiptText,
  ShieldAlert,
  Settings,
  Shield,
  Zap,
  CreditCard,
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

interface NavSection {
  heading?: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    heading: "Operations",
    items: [
      { to: "/wallets", label: "Wallets", icon: Wallet },
      { to: "/agents", label: "Agents", icon: Bot },
      { to: "/transactions", label: "Transactions", icon: ReceiptText },
    ],
  },
  {
    heading: "Governance",
    items: [
      { to: "/governance", label: "Governance", icon: ShieldAlert },
      { to: "/policy", label: "Policy & Access", icon: Shield },
    ],
  },
  {
    heading: "Extend",
    items: [
      { to: "/integrations", label: "Integrations", icon: Zap },
      { to: "/finance", label: "Finance", icon: CreditCard },
    ],
  },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <Link to="/" className="block px-5 py-5">
        <Wordmark />
      </Link>
      <nav className="flex-1 space-y-5 px-3">
        {sections.map((section, si) => (
          <div key={si}>
            {section.heading && (
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-faint">
                {section.heading}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/dashboard"}
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
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-line px-3 py-3">
        <NavLink
          to="/settings"
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
          <Settings className="h-[18px] w-[18px]" />
          Settings
        </NavLink>
      </div>

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
