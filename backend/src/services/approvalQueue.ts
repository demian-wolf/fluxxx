/**
 * Human-Approval Queue — transactions exceeding a configurable threshold
 * require explicit operator approval before settlement.
 *
 * Flow:
 *   Agent requests high-value tx → Policy engine approves budget-wise →
 *   Amount exceeds approval_threshold → Queued as "pending_approval" →
 *   Operator reviews in dashboard → approve/reject → Ledger entry written
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import {
  agentIdentitiesTable,
  agentWalletsTable,
  transactionRequestsTable,
} from "../db/schema";
import { writeLedgerEntry } from "./ledger";
import { generatePaymentToken } from "./auth";
import { config } from "../config/env";
import { dispatchAlert } from "./alerts";

export interface ApprovalQueueItem {
  id: string;
  agentId: string;
  agentName: string;
  walletId: string;
  walletName: string;
  requestedAmountCents: number;
  payeeUrl: string;
  description: string;
  status: "pending_approval" | "approved" | "rejected";
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface ApprovalQueueStats {
  pendingCount: number;
  approvedToday: number;
  rejectedToday: number;
  totalValue: number;
}

/** Default threshold: transactions >= €5 require approval */
const DEFAULT_APPROVAL_THRESHOLD_CENTS = 500;

/**
 * Check if a transaction requires human approval.
 */
export function requiresApproval(
  amountCents: number,
  thresholdCents: number = DEFAULT_APPROVAL_THRESHOLD_CENTS,
): boolean {
  return amountCents >= thresholdCents;
}

/**
 * Queue a transaction for human approval. The transaction is stored with
 * decision = "pending" and a special rejection_reason marker.
 */
export async function queueForApproval(params: {
  agentId: string;
  walletId: string;
  amountCents: number;
  payeeUrl: string;
  description: string;
}): Promise<{ transactionId: string; position: number }> {
  const [txn] = await db
    .insert(transactionRequestsTable)
    .values({
      agentId: params.agentId,
      walletId: params.walletId,
      requestedAmountCents: params.amountCents,
      payeeUrl: params.payeeUrl,
      description: params.description,
      decision: "pending",
      rejectionReason: "pending_approval",
    })
    .returning({ id: transactionRequestsTable.id });

  // Dispatch approval-required alert
  const [agent] = await db
    .select({ name: agentIdentitiesTable.name })
    .from(agentIdentitiesTable)
    .where(eq(agentIdentitiesTable.id, params.agentId))
    .limit(1);

  await dispatchAlert({
    type: "approval_required",
    timestamp: new Date().toISOString(),
    walletId: params.walletId,
    data: {
      transaction_id: txn.id,
      agent_id: params.agentId,
      agent_name: agent?.name ?? "unknown",
      amount_cents: params.amountCents,
      payee_url: params.payeeUrl,
    },
  });

  // Calculate queue position
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactionRequestsTable)
    .where(
      and(
        eq(transactionRequestsTable.decision, "pending"),
        eq(transactionRequestsTable.rejectionReason, "pending_approval"),
      ),
    );

  return { transactionId: txn.id, position: Number(count) };
}

/**
 * List all pending approval items.
 */
export async function listPendingApprovals(): Promise<ApprovalQueueItem[]> {
  const rows = await db
    .select({
      id: transactionRequestsTable.id,
      agentId: transactionRequestsTable.agentId,
      agentName: agentIdentitiesTable.name,
      walletId: transactionRequestsTable.walletId,
      walletName: agentWalletsTable.name,
      requestedAmountCents: transactionRequestsTable.requestedAmountCents,
      payeeUrl: transactionRequestsTable.payeeUrl,
      description: transactionRequestsTable.description,
      decision: transactionRequestsTable.decision,
      createdAt: transactionRequestsTable.createdAt,
    })
    .from(transactionRequestsTable)
    .innerJoin(agentIdentitiesTable, eq(transactionRequestsTable.agentId, agentIdentitiesTable.id))
    .innerJoin(agentWalletsTable, eq(transactionRequestsTable.walletId, agentWalletsTable.id))
    .where(
      and(
        eq(transactionRequestsTable.decision, "pending"),
        eq(transactionRequestsTable.rejectionReason, "pending_approval"),
      ),
    )
    .orderBy(desc(transactionRequestsTable.createdAt));

  return rows.map((r) => ({
    id: r.id,
    agentId: r.agentId,
    agentName: r.agentName,
    walletId: r.walletId,
    walletName: r.walletName,
    requestedAmountCents: r.requestedAmountCents,
    payeeUrl: r.payeeUrl,
    description: r.description,
    status: "pending_approval" as const,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: null,
    resolvedBy: null,
  }));
}

/**
 * Approve a queued transaction — write ledger entry and issue token.
 */
export async function approveTransaction(
  transactionId: string,
  _operatorId: string,
): Promise<{ paymentToken: string; balanceAfterCents: number }> {
  const [txn] = await db
    .select()
    .from(transactionRequestsTable)
    .where(
      and(
        eq(transactionRequestsTable.id, transactionId),
        eq(transactionRequestsTable.decision, "pending"),
        eq(transactionRequestsTable.rejectionReason, "pending_approval"),
      ),
    )
    .limit(1);

  if (!txn) throw new Error("transaction_not_found_or_already_resolved");

  const [wallet] = await db
    .select()
    .from(agentWalletsTable)
    .where(eq(agentWalletsTable.id, txn.walletId))
    .limit(1);

  if (!wallet) throw new Error("wallet_not_found");
  if (wallet.balanceCents < txn.requestedAmountCents) {
    throw new Error("insufficient_balance");
  }

  const token = generatePaymentToken();
  const expiresAt = new Date(Date.now() + config.flux.tokenTtlSeconds * 1000);

  const entry = await writeLedgerEntry({
    walletId: wallet.id,
    walletBalanceCents: wallet.balanceCents,
    agentId: txn.agentId,
    type: "spend",
    amountCents: txn.requestedAmountCents,
    description: txn.description,
    payeeUrl: txn.payeeUrl,
    paymentToken: token,
  });

  await db
    .update(transactionRequestsTable)
    .set({
      decision: "approved",
      paymentToken: token,
      tokenExpiresAt: expiresAt,
      rejectionReason: null,
      ledgerEntryId: entry.id,
    })
    .where(eq(transactionRequestsTable.id, transactionId));

  return { paymentToken: token, balanceAfterCents: entry.balanceAfterCents };
}

/**
 * Reject a queued transaction.
 */
export async function rejectTransaction(
  transactionId: string,
  _operatorId: string,
  reason: string = "operator_rejected",
): Promise<void> {
  await db
    .update(transactionRequestsTable)
    .set({
      decision: "rejected",
      rejectionReason: reason,
    })
    .where(
      and(
        eq(transactionRequestsTable.id, transactionId),
        eq(transactionRequestsTable.decision, "pending"),
      ),
    );
}

/**
 * Get approval queue statistics.
 */
export async function getApprovalStats(): Promise<ApprovalQueueStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [stats] = await db
    .select({
      pendingCount: sql<number>`count(*) filter (where ${transactionRequestsTable.decision} = 'pending' and ${transactionRequestsTable.rejectionReason} = 'pending_approval')`,
      totalValue: sql<number>`coalesce(sum(${transactionRequestsTable.requestedAmountCents}) filter (where ${transactionRequestsTable.decision} = 'pending' and ${transactionRequestsTable.rejectionReason} = 'pending_approval'), 0)`,
    })
    .from(transactionRequestsTable);

  return {
    pendingCount: Number(stats.pendingCount),
    approvedToday: 0,
    rejectedToday: 0,
    totalValue: Number(stats.totalValue),
  };
}
