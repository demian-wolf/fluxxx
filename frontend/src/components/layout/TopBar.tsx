import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  Settings as SettingsIcon,
  Wallet as WalletIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useWallets } from "@/context/WalletContext";
import { api } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useLiveLedger } from "@/hooks/useLiveLedger";
import { cn, formatCents, relativeTime } from "@/lib/utils";

function useOutsideClose(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  return ref;
}

function WalletSelector() {
  const { wallets, selected, selectWallet } = useWallets();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(() => setOpen(false));
  if (wallets.length === 0) return null;

  return (
    <div className="relative hidden sm:block" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-line bg-bg-raised/60 px-3 py-1.5 text-sm transition hover:border-flux-cyan/40"
      >
        <WalletIcon className="h-4 w-4 text-flux-cyan" />
        <span className="max-w-[160px] truncate font-medium text-ink">
          {selected?.name ?? "Select wallet"}
        </span>
        {selected && (
          <span className="font-mono text-xs text-ink-muted">
            {formatCents(selected.balance_cents)}
          </span>
        )}
        <ChevronDown className="h-4 w-4 text-ink-muted" />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-2 w-64 animate-fade-in rounded-lg border border-line bg-bg-raised shadow-card">
          {wallets.map((w) => (
            <button
              key={w.id}
              onClick={() => {
                selectWallet(w.id);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition first:rounded-t-lg last:rounded-b-lg hover:bg-bg-soft",
                selected?.id === w.id && "bg-bg-soft",
              )}
            >
              <span className="truncate text-ink">{w.name}</span>
              <span className="font-mono text-xs text-ink-muted">
                {formatCents(w.balance_cents)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(() => setOpen(false));
  const { data, refresh } = useAsync(
    () => api.listTransactions({ type: "rejected" }),
    [],
  );
  useLiveLedger(refresh);
  const alerts = (data ?? []).slice(0, 6);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg border border-line bg-bg-raised/60 p-2 transition hover:border-flux-cyan/40"
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px] text-ink-muted" />
        {alerts.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-flux-red px-1 text-[10px] font-bold text-bg">
            {alerts.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 animate-fade-in rounded-lg border border-line bg-bg-raised shadow-card">
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">Anomaly alerts</p>
            <p className="text-xs text-ink-muted">Recently rejected requests</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-muted">
                No anomalies. All clear.
              </p>
            ) : (
              alerts.map((a) => (
                <Link
                  key={a.id}
                  to={`/transactions/${a.id}`}
                  onClick={() => setOpen(false)}
                  className="block border-b border-line/60 px-4 py-3 transition last:border-0 hover:bg-bg-soft"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-ink">
                      {a.agent_name}
                    </span>
                    <span className="text-xs text-ink-faint">
                      {relativeTime(a.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-flux-red">
                    {a.rejection_reason}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(() => setOpen(false));
  const initials = (user?.full_name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-line bg-bg-raised/60 py-1 pl-1 pr-2 transition hover:border-flux-cyan/40"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-flux-cyan to-flux-violet text-xs font-bold text-bg">
          {initials}
        </span>
        <ChevronDown className="h-4 w-4 text-ink-muted" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-56 animate-fade-in rounded-lg border border-line bg-bg-raised shadow-card">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink">
              {user?.full_name}
            </p>
            <p className="truncate text-xs text-ink-muted">{user?.email}</p>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              navigate("/settings");
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink transition hover:bg-bg-soft"
          >
            <SettingsIcon className="h-4 w-4 text-ink-muted" />
            Settings
          </button>
          <button
            onClick={() => logout()}
            className="flex w-full items-center gap-2.5 rounded-b-lg px-4 py-2.5 text-left text-sm text-flux-red transition hover:bg-flux-red/10"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-bg/80 px-4 backdrop-blur-md lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg border border-line bg-bg-raised/60 p-2 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5 text-ink" />
        </button>
        <WalletSelector />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() =>
            window.dispatchEvent(new Event("open-command-palette"))
          }
          className="flex items-center gap-2 rounded-lg border border-line bg-bg-raised/60 px-3 py-2 text-sm text-ink-muted transition hover:border-flux-cyan/40 hover:text-ink"
          aria-label="Open command palette"
        >
          <Search className="h-[18px] w-[18px]" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden rounded border border-line bg-bg-soft px-1.5 py-0.5 font-mono text-[10px] text-ink-faint sm:inline">
            ⌘K
          </kbd>
        </button>
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
