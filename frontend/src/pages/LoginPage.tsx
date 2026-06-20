import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AuthShell } from "./AuthShell";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { IS_MOCK } from "@/api";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(IS_MOCK ? "operator@flux.dev" : "");
  const [password, setPassword] = useState(IS_MOCK ? "demo1234" : "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ email, password });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold text-ink">Sign in</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Welcome back, operator. Access your command center.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Email">
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </Field>

        {error && <p className="text-sm text-flux-red">{error}</p>}

        <Button type="submit" loading={loading} className="w-full">
          Sign in
        </Button>

        {IS_MOCK && (
          <p className="rounded-lg border border-line bg-bg-raised/40 px-3 py-2 text-xs text-ink-muted">
            Demo mode — any email/password works. Prefilled credentials get you
            straight in.
          </p>
        )}
      </form>

      <p className="mt-6 text-sm text-ink-muted">
        New operator?{" "}
        <Link to="/register" className="link font-medium">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
