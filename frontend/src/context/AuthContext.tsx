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
import type { User } from "@/types";
import type { LoginInput, RegisterInput } from "@/api/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  justRegistered: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  clearJustRegistered: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [justRegistered, setJustRegistered] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .currentUser()
      .then((u) => active && setUser(u))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const { user: u } = await api.login(input);
    setUser(u);
    setJustRegistered(false);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const { user: u } = await api.register(input);
    setUser(u);
    setJustRegistered(true);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const clearJustRegistered = useCallback(() => setJustRegistered(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      justRegistered,
      login,
      register,
      logout,
      setUser,
      clearJustRegistered,
    }),
    [user, loading, justRegistered, login, register, logout, clearJustRegistered],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
