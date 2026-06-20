import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, CreditCard, Landmark, Wallet } from "lucide-react";
import { api, IS_MOCK } from "@/api";
import { useToast } from "@/context/ToastContext";
import { useAsync } from "@/hooks/useAsync";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { LoadingState } from "@/components/ui/Spinner";
import { cn, formatCents } from "@/lib/utils";
import type { PaymentMethod } from "@/types";

const methods: { id: PaymentMethod; label: string; icon: typeof CreditCard; note: string }[] = [
  { id: "ideal", label: "iDEAL", icon: Landmark, note: "Netherlands · near-instant" },
  { id: "creditcard", label: "Credit Card", icon: CreditCard, note: "Visa / Mastercard" },
  { id: "bancontact", label: "Bancontact", icon: Wallet, note: "Belgium · near-instant" },
];

const presets = [1000, 2000, 5000, 10000];

export function DepositPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const wallet = useAsync(() => api.getWallet(id), [id]);

  const [amount, setAmount] = useState("20.00");
  const [method, setMethod] = useState<PaymentMethod>("ideal");
  const [submitting, setSubmitting] = useState(false);

  const amountCents = Math.round(parseFloat(amount || "0") * 100);
  const valid = amountCents >= 100;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    try {
      const res = await api.createDeposit({
        wallet_id: id,
        amount_cents: amountCents,
        method,
      });
      toast("info", "Redirecting to Mollie", "Complete your payment to continue.");
      if (IS_MOCK) {
        // The mock store lives in memory, so a full-page reload would discard
        // the payment we just created. Navigate client-side instead.
        const url = new URL(res.checkout_url);
        navigate(`${url.pathname}${url.search}`);
      } else {
        window.location.assign(res.checkout_url);
      }
    } catch {
      toast("error", "Could not start payment");
      setSubmitting(false);
    }
  };

  if (wallet.loading) return <LoadingState />;
  const w = wallet.data;

  return (
    <>
      <PageHeader
        title="Add funds"
        crumbs={[
          { label: "Wallets", to: "/wallets" },
          { label: w?.name ?? "Wallet", to: `/wallets/${id}` },
          { label: "Deposit" },
        ]}
        subtitle={w ? `Current balance: ${formatCents(w.balance_cents)}` : undefined}
      />

      <div className="mx-auto max-w-lg">
        <Card>
          <CardBody>
            <form onSubmit={onSubmit} className="space-y-6">
              <Field label="Amount (€)" hint="Minimum €1.00">
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  leading="€"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="font-mono text-lg"
                />
              </Field>

              <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount((p / 100).toFixed(2))}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                      amountCents === p
                        ? "border-flux-cyan/60 bg-flux-cyan/10 text-ink"
                        : "border-line bg-bg-raised/40 text-ink-muted hover:text-ink",
                    )}
                  >
                    {formatCents(p)}
                  </button>
                ))}
              </div>

              <div>
                <label className="label">Payment method</label>
                <div className="space-y-2">
                  {methods.map(({ id: mid, label, icon: Icon, note }) => (
                    <button
                      key={mid}
                      type="button"
                      onClick={() => setMethod(mid)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition",
                        method === mid
                          ? "border-flux-cyan/60 bg-flux-cyan/5"
                          : "border-line bg-bg-raised/30 hover:border-flux-cyan/30",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg border",
                          method === mid
                            ? "border-flux-cyan/40 text-flux-cyan"
                            : "border-line text-ink-muted",
                        )}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-medium text-ink">
                          {label}
                        </span>
                        <span className="block text-xs text-ink-muted">{note}</span>
                      </span>
                      <span
                        className={cn(
                          "h-4 w-4 rounded-full border-2",
                          method === mid
                            ? "border-flux-cyan bg-flux-cyan"
                            : "border-line",
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full" loading={submitting} disabled={!valid}>
                Continue to Payment <ArrowRight className="h-4 w-4" />
              </Button>

              {IS_MOCK && (
                <p className="text-center text-xs text-ink-faint">
                  Demo mode simulates the Mollie checkout and confirms payment
                  automatically.
                </p>
              )}
            </form>
          </CardBody>
        </Card>

        <button
          onClick={() => navigate(`/wallets/${id}`)}
          className="mx-auto mt-4 block text-sm text-ink-muted hover:text-ink"
        >
          Cancel and return to wallet
        </button>
      </div>
    </>
  );
}
