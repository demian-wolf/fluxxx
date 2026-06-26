import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  Bot,
  ReceiptText,
  Recycle,
  ShieldAlert,
  CreditCard,
  Store,
  KeyRound,
  Settings,
  TrendingDown,
  Shield,
  Bell,
  CheckCircle,
  ShieldCheck,
  Puzzle,
  Coins,
  Zap,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { Wordmark } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { IS_MOCK } from "@/api";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/agents", label: "Agents", icon: Bot },
      { to: "/wallets", label: "Wallets", icon: Wallet },
      { to: "/transactions", label: "Transactions", icon: ReceiptText },
    ],
  },
  {
    label: "Governance",
    items: [
      { to: "/oob", label: "OOB Killer", icon: ShieldAlert },
      { to: "/approval", label: "Approval Queue", icon: CheckCircle },
      { to: "/forecast", label: "Forecasting", icon: TrendingDown },
    ],
  },
  {
    label: "Integrations",
    items: [
      { to: "/devin", label: "Devin", icon: Zap },
      { to: "/webhooks", label: "Webhooks", icon: Bell },
    ],
  },
];

const moreItems: NavItem[] = [
  { to: "/gc", label: "Capital Reclamation", icon: Recycle },
  { to: "/reputation", label: "Reputation", icon: Shield },
  { to: "/plugins", label: "Policy Plugins", icon: Puzzle },
  { to: "/currency", label: "Multi-Currency", icon: Coins },
  { to: "/agent-access", label: "Wallet Access", icon: ShieldCheck },
  { to: "/billing", label: "Billing & Fees", icon: CreditCard },
  { to: "/providers", label: "Providers", icon: Store },
  { to: "/licensing", label: "Licensing", icon: KeyRound },
];

const morePaths = moreItems.map((i) => i.to);

function SidebarLink({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate?: () => void;
}) {
  const { to, label, icon: Icon } = item;
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
          isActive
            ? "bg-flux-cyan/10 text-ink shadow-[inset_2px_0_0_0_#22d3ee]"
            : "text-ink-muted hover:bg-bg-raised/60 hover:text-ink",
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </NavLink>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const isMoreActive = morePaths.some((p) => pathname.startsWith(p));
  const [moreOpen, setMoreOpen] = useState(isMoreActive);

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Wordmark />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-2">
        {sections.map((section, i) => (
          <div key={section.label ?? i} className={cn(i > 0 && "mt-4")}>
            {section.label && (
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted/60">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarLink
                  key={item.to}
                  item={item}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Collapsible "More" section */}
        <div className="mt-4">
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition",
              isMoreActive && !moreOpen
                ? "text-flux-cyan"
                : "text-ink-muted/60 hover:text-ink-muted",
            )}
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                moreOpen && "rotate-180",
              )}
            />
            More
            {isMoreActive && !moreOpen && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-flux-cyan" />
            )}
          </button>
          {moreOpen && (
            <div className="mt-0.5 space-y-0.5">
              {moreItems.map((item) => (
                <SidebarLink
                  key={item.to}
                  item={item}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Settings pinned at bottom */}
      <div className="border-t border-line px-3 py-2">
        <SidebarLink
          item={{ to: "/settings", label: "Settings", icon: Settings }}
          onNavigate={onNavigate}
        />
      </div>

      <div className="px-5 py-3">
        <div className="rounded-lg border border-line bg-bg-raised/50 p-3">
          <p className="text-xs font-semibold text-ink">
            {IS_MOCK ? "Demo mode" : "Live backend"}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-ink-muted">
            {IS_MOCK
              ? "In-memory FLUX simulation."
              : "Connected to live FLUX deployment."}
          </p>
        </div>
      </div>
    </div>
  );
}
