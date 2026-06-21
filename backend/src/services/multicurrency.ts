/**
 * Multi-Currency Foundation.
 *
 * Provides exchange rate lookup, conversion, and currency configuration
 * for extending FLUXXX beyond EUR-only. Initially supports EUR, USD, GBP
 * with configurable rates (static for MVP, API-backed in production).
 */

export type SupportedCurrency = "EUR" | "USD" | "GBP" | "USDC";

export interface ExchangeRate {
  from: SupportedCurrency;
  to: SupportedCurrency;
  rate: number;
  updatedAt: string;
}

export interface CurrencyConfig {
  code: SupportedCurrency;
  name: string;
  symbol: string;
  decimals: number;
  minTransactionCents: number;
  supported: boolean;
}

export interface ConversionResult {
  fromCurrency: SupportedCurrency;
  toCurrency: SupportedCurrency;
  fromAmountCents: number;
  toAmountCents: number;
  rate: number;
  rateTimestamp: string;
}

// Static exchange rates (EUR-based, updated manually for MVP)
const EXCHANGE_RATES: Record<string, number> = {
  "EUR:USD": 1.09,
  "EUR:GBP": 0.86,
  "EUR:USDC": 1.09,
  "USD:EUR": 0.92,
  "USD:GBP": 0.79,
  "USD:USDC": 1.00,
  "GBP:EUR": 1.16,
  "GBP:USD": 1.27,
  "GBP:USDC": 1.27,
  "USDC:EUR": 0.92,
  "USDC:USD": 1.00,
  "USDC:GBP": 0.79,
};

const CURRENCIES: CurrencyConfig[] = [
  { code: "EUR", name: "Euro", symbol: "\u20AC", decimals: 2, minTransactionCents: 1, supported: true },
  { code: "USD", name: "US Dollar", symbol: "$", decimals: 2, minTransactionCents: 1, supported: true },
  { code: "GBP", name: "British Pound", symbol: "\u00A3", decimals: 2, minTransactionCents: 1, supported: true },
  { code: "USDC", name: "USD Coin", symbol: "USDC", decimals: 2, minTransactionCents: 1, supported: false },
];

let ratesLastUpdated = new Date().toISOString();

/**
 * Get exchange rate between two currencies.
 */
export function getExchangeRate(from: SupportedCurrency, to: SupportedCurrency): ExchangeRate {
  if (from === to) {
    return { from, to, rate: 1.0, updatedAt: ratesLastUpdated };
  }

  const key = `${from}:${to}`;
  const rate = EXCHANGE_RATES[key];

  if (rate === undefined) {
    throw new Error(`unsupported_currency_pair: ${key}`);
  }

  return { from, to, rate, updatedAt: ratesLastUpdated };
}

/**
 * Convert an amount from one currency to another.
 */
export function convertCurrency(
  fromAmountCents: number,
  from: SupportedCurrency,
  to: SupportedCurrency,
): ConversionResult {
  const { rate, updatedAt } = getExchangeRate(from, to);
  const toAmountCents = Math.round(fromAmountCents * rate);

  return {
    fromCurrency: from,
    toCurrency: to,
    fromAmountCents,
    toAmountCents,
    rate,
    rateTimestamp: updatedAt,
  };
}

/**
 * List all supported currencies.
 */
export function listCurrencies(): CurrencyConfig[] {
  return [...CURRENCIES];
}

/**
 * Get all current exchange rates.
 */
export function getAllRates(): ExchangeRate[] {
  const rates: ExchangeRate[] = [];
  for (const [key, rate] of Object.entries(EXCHANGE_RATES)) {
    const [from, to] = key.split(":") as [SupportedCurrency, SupportedCurrency];
    rates.push({ from, to, rate, updatedAt: ratesLastUpdated });
  }
  return rates;
}

/**
 * Update exchange rates (for scheduled rate refresh).
 */
export function updateRates(newRates: Record<string, number>): void {
  for (const [key, rate] of Object.entries(newRates)) {
    EXCHANGE_RATES[key] = rate;
  }
  ratesLastUpdated = new Date().toISOString();
}

/**
 * Format an amount in the given currency.
 */
export function formatAmount(cents: number, currency: SupportedCurrency): string {
  const cfg = CURRENCIES.find((c) => c.code === currency);
  if (!cfg) return `${cents} ${currency}`;
  const value = (cents / Math.pow(10, cfg.decimals)).toFixed(cfg.decimals);
  return `${cfg.symbol}${value}`;
}
