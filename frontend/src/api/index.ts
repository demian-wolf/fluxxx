import type { FluxApi } from "@/api/types";
import { mockApi, subscribeToLedger as mockSubscribe } from "@/api/mock/mockApi";
import { createHttpApi } from "@/api/http";

const useMock = (import.meta.env.VITE_USE_MOCK ?? "true") !== "false";
const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export const api: FluxApi = useMock ? mockApi : createHttpApi(baseUrl);

export const IS_MOCK = useMock;

/**
 * Subscribe to live ledger pushes. In mock mode this is driven by the in-memory
 * simulation; against a real backend, screens fall back to interval polling.
 */
export function subscribeToLedger(fn: () => void): () => void {
  if (useMock) return mockSubscribe(fn);
  return () => {};
}

export type { FluxApi } from "@/api/types";
