import { Link } from "react-router-dom";
import { LogoMark } from "@/components/Logo";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <LogoMark className="h-10 w-10" />
      <p className="font-mono text-5xl font-bold text-ink">404</p>
      <p className="text-sm text-ink-muted">
        This route doesn&apos;t exist in the FLUX gateway.
      </p>
      <Link to="/dashboard" className="btn-primary mt-2">
        Back to dashboard
      </Link>
    </div>
  );
}
