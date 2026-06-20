import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { api } from "@/api";
import { Card, CardBody } from "@/components/ui/Card";
import { formatCents } from "@/lib/utils";
import type { MolliePayment } from "@/types";

type Phase = "polling" | "paid" | "failed";

export function DepositSuccessPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const paymentId = params.get("payment_id");

  const [phase, setPhase] = useState<Phase>(paymentId ? "polling" : "failed");
  const [payment, setPayment] = useState<MolliePayment | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (!paymentId) return;
    let attempts = 0;
    let stopped = false;
    const scheduled = timers.current;

    const poll = async () => {
      if (stopped) return;
      attempts += 1;
      try {
        const p = await api.getPaymentStatus(paymentId);
        setPayment(p);
        if (p.status === "paid") {
          setPhase("paid");
          const t = window.setTimeout(
            () => navigate(`/wallets/${p.wallet_id}`),
            3000,
          );
          timers.current.push(t);
          return;
        }
        if (p.status === "failed" || p.status === "expired") {
          setPhase("failed");
          return;
        }
      } catch {
        /* keep polling */
      }
      if (attempts >= 15) {
        setPhase("failed");
        return;
      }
      const t = window.setTimeout(poll, 2000);
      timers.current.push(t);
    };

    poll();
    return () => {
      stopped = true;
      scheduled.forEach((t) => clearTimeout(t));
    };
  }, [paymentId, navigate]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardBody className="px-8 py-10 text-center">
          {phase === "polling" && (
            <>
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-flux-cyan" />
              <h2 className="mt-5 text-lg font-semibold text-ink">
                Confirming your payment…
              </h2>
              <p className="mt-2 text-sm text-ink-muted">
                We&apos;re waiting for Mollie to settle the transaction. This
                usually takes a few seconds.
              </p>
            </>
          )}

          {phase === "paid" && payment && (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-flux-green/15">
                <CheckCircle2 className="h-9 w-9 text-flux-green" />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-ink">
                Payment confirmed
              </h2>
              <p className="mt-2 text-sm text-ink-muted">
                <span className="font-mono text-flux-green">
                  +{formatCents(payment.amount_cents)}
                </span>{" "}
                added to your wallet.
              </p>
              <p className="mt-4 text-xs text-ink-faint">
                Redirecting to wallet…
              </p>
            </>
          )}

          {phase === "failed" && (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-flux-red/15">
                <XCircle className="h-9 w-9 text-flux-red" />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-ink">
                Payment not completed
              </h2>
              <p className="mt-2 text-sm text-ink-muted">
                {paymentId
                  ? "The payment failed or expired before it could be confirmed."
                  : "No payment reference was provided."}
              </p>
              <Link
                to={payment ? `/wallets/${payment.wallet_id}/deposit` : "/wallets"}
                className="btn-primary mt-5"
              >
                Try again
              </Link>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
