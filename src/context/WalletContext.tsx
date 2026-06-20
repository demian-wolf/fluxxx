import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/api";
import type { AgentWallet } from "@/types";

interface WalletContextValue {
  wallets: AgentWallet[];
  loading: boolean;
  selectedId: string | null;
  selected: AgentWallet | null;
  selectWallet: (id: string) => void;
  refresh: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);
const SELECTED_KEY = "flux.selectedWallet";

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<AgentWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => localStorage.getItem(SELECTED_KEY),
  );

  const refresh = useCallback(async () => {
    const list = await api.listWallets();
    setWallets(list);
    setSelectedId((prev) => {
      if (prev && list.some((w) => w.id === prev)) return prev;
      return list[0]?.id ?? null;
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectWallet = useCallback((id: string) => {
    setSelectedId(id);
    localStorage.setItem(SELECTED_KEY, id);
  }, []);

  const selected = useMemo(
    () => wallets.find((w) => w.id === selectedId) ?? null,
    [wallets, selectedId],
  );

  const value = useMemo<WalletContextValue>(
    () => ({ wallets, loading, selectedId, selected, selectWallet, refresh }),
    [wallets, loading, selectedId, selected, selectWallet, refresh],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWallets(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallets must be used within WalletProvider");
  return ctx;
}
