import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { agentWalletsTable, ledgerEntriesTable, LedgerEntry } from "../db/schema";
import { UUID } from "../types";

export interface LedgerWriteInput {
  walletId: UUID;
  walletBalanceCents: number;
  agentId: UUID | null;
  type: "deposit" | "spend" | "fee" | "refund" | "hold" | "release";
  amountCents: number;
  description: string;
  payeeUrl?: string | null;
  molliePaymentId?: string | null;
  paymentToken?: string | null;
  status?: "pending" | "settled" | "failed" | "reversed";
  metadata?: Record<string, unknown>;
}

/** Direction of a ledger entry on the wallet balance, by type. */
function signedDelta(type: LedgerWriteInput["type"], amountCents: number): number {
  switch (type) {
    case "deposit":
    case "refund":
    case "release":
      return amountCents;
    case "spend":
    case "fee":
    case "hold":
      return -amountCents;
    default:
      return 0;
  }
}

/**
 * Atomic balance mutation: append a ledger entry and update the wallet's
 * cached balance_cents in the same logical operation. Must be called inside
 * a transaction or sequentially — never update balance directly elsewhere.
 */
export async function writeLedgerEntry(input: LedgerWriteInput): Promise<LedgerEntry> {
  const delta = signedDelta(input.type, input.amountCents);
  const balanceAfter = input.walletBalanceCents + delta;

  const [entry] = await db
    .insert(ledgerEntriesTable)
    .values({
      walletId:          input.walletId,
      agentId:           input.agentId ?? undefined,
      type:              input.type,
      amountCents:       input.amountCents,
      balanceAfterCents: balanceAfter,
      description:       input.description,
      payeeUrl:          input.payeeUrl ?? undefined,
      molliePaymentId:   input.molliePaymentId ?? undefined,
      paymentToken:      input.paymentToken ?? undefined,
      status:            input.status ?? "settled",
      metadata:          input.metadata ?? undefined,
    })
    .returning();

  await db
    .update(agentWalletsTable)
    .set({ balanceCents: balanceAfter, updatedAt: new Date() })
    .where(eq(agentWalletsTable.id, input.walletId));

  return entry;
}

/** Sum of settled spend for an agent within the last `windowMs` milliseconds. */
export async function spentInWindow(
  _walletId: UUID,
  agentId: UUID,
  windowMs: number,
): Promise<number> {
  const cutoff = new Date(Date.now() - windowMs);
  const [{ total }] = await db
    .select({ total: sql<number>`coalesce(sum(${ledgerEntriesTable.amountCents}), 0)` })
    .from(ledgerEntriesTable)
    .where(
      and(
        eq(ledgerEntriesTable.agentId, agentId),
        eq(ledgerEntriesTable.type, "spend"),
        eq(ledgerEntriesTable.status, "settled"),
        gte(ledgerEntriesTable.createdAt, cutoff),
      ),
    );
  return Number(total);
}
