import { useCallback, useState } from "react";
import { ArrowRightLeft, Globe } from "lucide-react";
import { api } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useRefreshOnFocus } from "@/hooks/useInterval";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/Spinner";
import type { SupportedCurrency, ConversionResult } from "@/types";

export function CurrencyPage() {
  const currencies = useAsync(() => api.listCurrencies(), []);
  const rates = useAsync(() => api.getExchangeRates(), []);
  const [fromCurrency, setFromCurrency] = useState<SupportedCurrency>("EUR");
  const [toCurrency, setToCurrency] = useState<SupportedCurrency>("USD");
  const [amount, setAmount] = useState("1000");
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [converting, setConverting] = useState(false);

  const refreshAll = useCallback(() => {
    currencies.refresh();
    rates.refresh();
  }, [currencies, rates]);
  useRefreshOnFocus(refreshAll);

  const handleConvert = async () => {
    setConverting(true);
    try {
      const r = await api.convertCurrency(parseInt(amount, 10), fromCurrency, toCurrency);
      setResult(r);
    } finally {
      setConverting(false);
    }
  };

  if (currencies.loading && !currencies.data) return <LoadingState label="Loading currencies..." />;

  const currencyOptions = (currencies.data ?? [])
    .filter((c) => c.supported)
    .map((c) => ({ value: c.code, label: `${c.symbol} ${c.name} (${c.code})` }));

  return (
    <>
      <PageHeader
        title="Multi-Currency"
        subtitle="Exchange rates and currency conversion for cross-border agent transactions."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Currency Converter" subtitle="Convert between supported currencies" />
          <CardBody>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="From">
                  <Select
                    value={fromCurrency}
                    onChange={(e) => setFromCurrency(e.target.value as SupportedCurrency)}
                    options={currencyOptions}
                  />
                </Field>
                <Field label="To">
                  <Select
                    value={toCurrency}
                    onChange={(e) => setToCurrency(e.target.value as SupportedCurrency)}
                    options={currencyOptions}
                  />
                </Field>
              </div>
              <Field label="Amount (cents)">
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1000"
                />
              </Field>
              <Button variant="primary" onClick={handleConvert} loading={converting} className="w-full">
                <ArrowRightLeft className="h-4 w-4" /> Convert
              </Button>
              {result && (
                <div className="rounded-lg border border-flux-cyan/30 bg-flux-cyan/5 p-3 text-center">
                  <div className="text-xs text-ink-muted">Result</div>
                  <div className="text-xl font-bold text-ink">
                    {result.toAmountCents} <span className="text-sm text-ink-muted">{result.toCurrency} cents</span>
                  </div>
                  <div className="text-xs text-ink-muted mt-1">
                    Rate: 1 {result.fromCurrency} = {result.rate} {result.toCurrency}
                  </div>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Exchange Rates" subtitle="Current rates (EUR-based)" />
          <div className="p-0">
            {rates.loading && !rates.data ? (
              <div className="p-4"><LoadingState /></div>
            ) : (
              <div className="divide-y divide-line">
                {(rates.data ?? []).map((rate, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-ink-muted">{rate.from} → {rate.to}</span>
                    <span className="font-mono text-ink">{rate.rate.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Supported Currencies" subtitle="Available currencies and their status" />
          <div className="p-0">
            <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-y-0 sm:divide-x">
              {(currencies.data ?? []).map((cur) => (
                <div key={cur.code} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-ink-muted" />
                    <div>
                      <div className="text-sm font-medium text-ink">{cur.symbol} {cur.name}</div>
                      <div className="text-xs text-ink-muted">{cur.code}</div>
                    </div>
                  </div>
                  <Badge tone={cur.supported ? "green" : "neutral"}>
                    {cur.supported ? "Active" : "Coming Soon"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
