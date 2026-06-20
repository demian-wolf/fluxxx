import { useEffect } from "react";
import { IS_MOCK, subscribeToLedger } from "@/api";
import { useInterval } from "./useInterval";

/**
 * Triggers `onUpdate` whenever new ledger activity arrives. In mock mode this is
 * push-driven by the in-memory simulation; against a real backend it falls back
 * to interval polling at `pollMs` (Base44 live-query equivalent).
 */
export function useLiveLedger(onUpdate: () => void, pollMs = 2000) {
  useEffect(() => {
    if (!IS_MOCK) return;
    return subscribeToLedger(onUpdate);
  }, [onUpdate]);

  useInterval(onUpdate, IS_MOCK ? null : pollMs);
}
