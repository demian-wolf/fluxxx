import { Link, useParams } from "react-router-dom";
import { Check, X, CreditCard } from "lucide-react";
import { api } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DecisionBadge } from "@/components/ui/StatusBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { LoadingState, ErrorState } from "@/components/ui/Spinner";
import { cn, formatCents, formatDateTime, formatTime } from "@/lib/utils";

export function TransactionDetailPage() {
  const { id = "" } = useParams();
  const tx = useAsync(() => api.getTransaction(id), [id]);
  const billing = useAsync(() => api.getBillingAccount(), []);

  if (tx.loading) return <LoadingState />;
  if (tx.error || !tx.data)
    return <ErrorState message={tx.error ?? "not found"} onRetry={tx.refresh} />;

  const t = tx.data;
  const tokenExpired =
    t.token_expires_at != null && new Date(t.token_expires_at).getTime() < Date.now();

  return (
    <>
      <PageHeader
        title={
          <span className="font-mono text-lg">
            Transaction {t.id}
          </span>
        }
        crumbs={[{ label: "Transactions", to: "/transactions" }, { label: t.id }]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Summary"
              right={<DecisionBadge decision={t.decision} />}
            />
            <CardBody className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <Detail label="Time" value={formatDateTime(t.created_at)} />
              <Detail
                label="Agent"
                value={
                  <Link to={`/agents/${t.agent_id}`} className="link">
                    {t.agent_name}
                  </Link>
                }
              />
              <Detail
                label="Wallet"
                value={
                  <Link to={`/wallets/${t.wallet_id}`} className="link">
                    {t.wallet_name}
                  </Link>
                }
              />
              <Detail
                label="Amount"
                value={
                  <span className="font-mono text-ink">
                    {formatCents(t.requested_amount_cents)}
                  </span>
                }
              />
              <Detail label="Category" value={t.category ?? "—"} />
              {t.rejection_reason && (
                <Detail
                  label="Rejection reason"
                  value={<span className="text-flux-red">{t.rejection_reason}</span>}
                />
              )}
              <div className="sm:col-span-2">
                <Detail
                  label="Payee URL"
                  value={
                    <span className="break-all font-mono text-xs text-ink-muted">
                      {t.payee_url}
                    </span>
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Detail label="Description" value={`"${t.description}"`} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Policy check" subtitle="KYA engine evaluation, in order" />
            <CardBody>
              <ul className="space-y-2">
                {t.policy_checks.map((c) => (
                  <li
                    key={c.rule}
                    className="flex items-center gap-3 rounded-lg border border-line bg-bg-raised/30 px-3 py-2"
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full",
                        c.passed
                          ? "bg-flux-green/15 text-flux-green"
                          : "bg-flux-red/15 text-flux-red",
                      )}
                    >
                      {c.passed ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <span className="font-mono text-xs text-ink">{c.label}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Payment token" />
            <CardBody>
              {t.payment_token ? (
                <>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 break-all rounded-md bg-bg px-2 py-1.5 font-mono text-xs text-ink">
                      {t.payment_token}
                    </code>
                    <CopyButton value={t.payment_token} />
                  </div>
                  <dl className="mt-3 space-y-2 text-xs">
                    <Row label="Expires">
                      <span
                        className={cn(
                          "font-mono",
                          tokenExpired ? "text-flux-red" : "text-ink",
                        )}
                      >
                        {t.token_expires_at
                          ? `${formatTime(t.token_expires_at)} ${
                              tokenExpired ? "(expired)" : ""
                            }`
                          : "—"}
                      </span>
                    </Row>
                    <Row label="Used">
                      <span className="font-mono text-flux-green">
                        {t.token_used_at
                          ? `✓ ${formatTime(t.token_used_at)}`
                          : "not used"}
                      </span>
                    </Row>
                  </dl>
                </>
              ) : (
                <p className="text-sm text-ink-muted">
                  No token issued — request was {t.decision}.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Ledger entry" />
            <CardBody>
              {t.ledger_entry_id ? (
                <dl className="space-y-2 text-sm">
                  <Row label="Balance before">
                    <span className="font-mono text-ink">
                      {formatCents(t.balance_before_cents)}
                    </span>
                  </Row>
                  <Row label="Deducted">
                    <span className="font-mono text-ink">
                      -{formatCents(t.requested_amount_cents)}
                    </span>
                  </Row>
                  <Row label="Balance after">
                    <span className="font-mono text-flux-cyan">
                      {t.balance_after_cents != null
                        ? formatCents(t.balance_after_cents)
                        : "—"}
                    </span>
                  </Row>
                </dl>
              ) : (
                <p className="text-sm text-ink-muted">
                  No ledger entry — balance was not affected.
                </p>
              )}
            </CardBody>
          </Card>

          {t.decision === "approved" && billing.data && (
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-flux-amber" /> Platform fee
                  </span>
                }
              />
              <CardBody>
                <dl className="space-y-2 text-sm">
                  <Row label="Gross amount">
                    <span className="font-mono text-ink">
                      {formatCents(t.requested_amount_cents)}
                    </span>
                  </Row>
                  <Row label="Fee rate">
                    <span className="font-mono text-ink-muted">
                      {(billing.data.tx_fee_bps / 100).toFixed(1)}%
                    </span>
                  </Row>
                  <Row label="Fee">
                    <span className="font-mono text-flux-amber">
                      -{formatCents(
                        Math.max(1, Math.round(t.requested_amount_cents * billing.data.tx_fee_bps / 10000)),
                      )}
                    </span>
                  </Row>
                  <Row label="Net to provider">
                    <span className="font-mono text-flux-green">
                      {formatCents(
                        t.requested_amount_cents -
                          Math.max(1, Math.round(t.requested_amount_cents * billing.data.tx_fee_bps / 10000)),
                      )}
                    </span>
                  </Row>
                </dl>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </p>
      <p className="mt-1 text-sm text-ink">{value}</p>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
