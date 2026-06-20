export interface PolicyFormValues {
  perTx: string;
  hourly: string;
  daily: string;
  allowed: string;
  blocked: string;
}

export const emptyPolicyValues: PolicyFormValues = {
  perTx: "0.10",
  hourly: "2.00",
  daily: "10.00",
  allowed: "",
  blocked: "",
};

export function policyValuesToCents(v: PolicyFormValues) {
  return {
    per_tx_limit_cents: Math.round(parseFloat(v.perTx || "0") * 100),
    hourly_limit_cents: Math.round(parseFloat(v.hourly || "0") * 100),
    daily_limit_cents: Math.round(parseFloat(v.daily || "0") * 100),
  };
}
