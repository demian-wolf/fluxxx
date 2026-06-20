import { v4 as uuidv4 } from "uuid";
import { store, ledgerForWallet } from "../store";
import { AgentWallet, LedgerEntry } from "../models";
import { LedgerEntryStatus, LedgerEntryType, UUID } from "../types";

export interface LedgerWriteInput {
  wallet: AgentWallet;
  agentId: UUID | null;
  type: LedgerEntryType;
  amountCents: number;
  description: string;
  payeeUrl?: string | null;
  molliePaymentId?: string | null;
  paymentToken?: string | null;
  status?: LedgerEntryStatus;
  metadata?: Record<string, unknown>;
}

/** Direction of a ledger entry on the wallet balance, by type. */
function signedDelta(type: LedgerEntryType, amountCents: number): number {
  switch (type) {
    case LedgerEntryType.Deposit:
    case LedgerEntryType.Refund:
    case LedgerEntryType.Release:
      return amountCents;
    case LedgerEntryType.Spend:
    case LedgerEntryType.Hold:
      return -amountCents;
    default:
      return 0;
  }
}

/**
 * Atomic balance mutation: append a ledger entry and recompute the wallet's
 * cached `balance_cents` projection. Balance is never edited directly.
 */
export function writeLedgerEntry(input: LedgerWriteInput): LedgerEntry {
  const { wallet } = input;
  const delta = signedDelta(input.type, input.amountCents);
  const balanceAfter = wallet.balance_cents + delta;

  const entry: LedgerEntry = {
    id: uuidv4(),
    wallet_id: wallet.id,
    agent_id: input.agentId,
    type: input.type,
    amount_cents: input.amountCents,
    balance_after_cents: balanceAfter,
    description: input.description,
    payee_url: input.payeeUrl ?? null,
    mollie_payment_id: input.molliePaymentId ?? null,
    payment_token: input.paymentToken ?? null,
    status: input.status ?? LedgerEntryStatus.Settled,
    metadata: input.metadata ?? {},
    created_at: new Date().toISOString(),
  };

  store.ledger.set(entry.id, entry);

  wallet.balance_cents = balanceAfter;
  wallet.updated_at = entry.created_at;
  store.wallets.set(wallet.id, wallet);

  return entry;
}

/** Sum of settled spend for an agent within the last `windowMs` milliseconds. */
export function spentInWindow(
  walletId: UUID,
  agentId: UUID,
  windowMs: number,
): number {
  const cutoff = Date.now() - windowMs;
  return ledgerForWallet(walletId)
    .filter(
      (e) =>
        e.agent_id === agentId &&
        e.type === LedgerEntryType.Spend &&
        e.status === LedgerEntryStatus.Settled &&
        new Date(e.created_at).getTime() >= cutoff,
    )
    .reduce((sum, e) => sum + e.amount_cents, 0);
}
