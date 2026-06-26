import {
  LayoutDashboard,
  Wallet,
  Bot,
  ReceiptText,
  ShieldAlert,
  Recycle,
  TrendingDown,
  CheckCircle,
  Puzzle,
  ShieldCheck,
  Shield,
  Zap,
  Bell,
  CreditCard,
  Coins,
  Store,
  KeyRound,
  Settings,
  Plus,
  type LucideIcon,
} from "lucide-react";

export interface Destination {
  label: string;
  to: string;
  icon: LucideIcon;
  section: string;
  keywords?: string;
}

export const destinations: Destination[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, section: "Overview", keywords: "home command center" },

  { label: "Wallets", to: "/assets?tab=wallets", icon: Wallet, section: "Assets", keywords: "balance funds deposit" },
  { label: "Agents", to: "/assets?tab=agents", icon: Bot, section: "Assets", keywords: "agent process tree" },
  { label: "Transactions", to: "/transactions", icon: ReceiptText, section: "Assets", keywords: "ledger spend history" },

  { label: "OOB Killer", to: "/governance?tab=oob", icon: ShieldAlert, section: "Governance", keywords: "out of budget kill emergency" },
  { label: "Capital Reclamation", to: "/governance?tab=gc", icon: Recycle, section: "Governance", keywords: "garbage collection zombie funds" },
  { label: "Forecasting", to: "/governance?tab=forecast", icon: TrendingDown, section: "Governance", keywords: "burn rate depletion prediction" },
  { label: "Approval Queue", to: "/governance?tab=approval", icon: CheckCircle, section: "Governance", keywords: "human in the loop approve reject" },

  { label: "Policy Plugins", to: "/policy?tab=plugins", icon: Puzzle, section: "Policy & Access", keywords: "rules anomaly velocity" },
  { label: "Wallet Access", to: "/policy?tab=access", icon: ShieldCheck, section: "Policy & Access", keywords: "permissions agent access" },
  { label: "Reputation", to: "/policy?tab=reputation", icon: Shield, section: "Policy & Access", keywords: "trust score grade" },

  { label: "Devin", to: "/integrations?tab=devin", icon: Zap, section: "Integrations", keywords: "built by devin cognition" },
  { label: "Webhooks", to: "/integrations?tab=webhooks", icon: Bell, section: "Integrations", keywords: "events alerts dispatch" },

  { label: "Billing & Fees", to: "/finance?tab=billing", icon: CreditCard, section: "Finance", keywords: "transaction fee invoice" },
  { label: "Multi-Currency", to: "/finance?tab=currency", icon: Coins, section: "Finance", keywords: "eur usd gbp usdc convert" },
  { label: "Providers", to: "/finance?tab=providers", icon: Store, section: "Finance", keywords: "payee marketplace" },
  { label: "Licensing", to: "/finance?tab=licensing", icon: KeyRound, section: "Finance", keywords: "white label sdk" },

  { label: "Settings", to: "/settings", icon: Settings, section: "Overview", keywords: "profile account preferences" },
];

export const quickActions: Destination[] = [
  { label: "Create new agent", to: "/agents/new", icon: Plus, section: "Actions", keywords: "register spawn agent" },
];
