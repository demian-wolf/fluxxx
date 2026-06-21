import { Router } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { agentIdentitiesTable, agentWalletsTable, spendPoliciesTable, transactionRequestsTable } from "../db/schema";
import { agentAuth } from "../middleware/agentAuth";
import { userAuth } from "../middleware/userAuth";
import { asyncHandler } from "../utils/asyncHandler";
import { evaluate } from "../services/policyEngine";
import { writeLedgerEntry } from "../services/ledger";
import { checkAndKill } from "../services/oobKiller";
import { generatePaymentToken } from "../services/auth";
import { config } from "../config/env";
import { RejectionReason } from "../types";

const router = Router();

/** Map a rejection reason to a retry hint where one is meaningful. */
function retryAfterSeconds(reason: RejectionReason): number | undefined {
  if (reason === RejectionReason.HourlyLimitExceeded) return 3600;
  if (reason === RejectionReason.DailyLimitExceeded) return 86400;
  return undefined;
}

/**
 * POST /api/transactions/request — core HTTP 402 flow.
 * (backend-architecture.md section 2.2)
 */
router.post(
  "/request",
  agentAuth,
  asyncHandler(async (req, res) => {
    const session = req.agent!;
    const { amount_cents, payee_url, description } = req.body ?? {};

    if (typeof amount_cents !== "number" || amount_cents <= 0) {
      res.status(400).json({ error: "invalid_amount" });
      return;
    }
    if (typeof payee_url !== "string") {
      res.status(400).json({ error: "missing_payee_url" });
      return;
    }

    const [agent] = await db
      .select()
      .from(agentIdentitiesTable)
      .where(eq(agentIdentitiesTable.id, session.sub))
      .limit(1);

    const [wallet] = await db
      .select()
      .from(agentWalletsTable)
      .where(eq(agentWalletsTable.id, session.wallet_id))
      .limit(1);

    if (!agent || !wallet) {
      res.status(404).json({ error: "agent_or_wallet_not_found" });
      return;
    }

    const [policy] = await db
      .select()
      .from(spendPoliciesTable)
      .where(and(eq(spendPoliciesTable.agentId, agent.id), eq(spendPoliciesTable.isActive, true)))
      .limit(1);

    const desc = typeof description === "string" ? description : "";
    const result = await evaluate({
      agent,
      wallet,
      policy,
      amountCents:  amount_cents,
      payeeUrl:     payee_url,
      description:  desc,
    });

    if (!result.approved) {
      await db.insert(transactionRequestsTable).values({
        agentId:              agent.id,
        walletId:             wallet.id,
        requestedAmountCents: amount_cents,
        payeeUrl:             payee_url,
        description:          desc,
        decision:             "rejected",
        rejectionReason:      result.reason,
      });

      res.status(402).json({
        decision:         "rejected",
        rejection_reason: result.reason,
        ...(result.details ?? {}),
        ...(retryAfterSeconds(result.reason) !== undefined
          ? { retry_after_seconds: retryAfterSeconds(result.reason) }
          : {}),
      });
      return;
    }

    // Approved: write spend + platform fee ledger entries, then issue token.
    const token     = generatePaymentToken();
    const expiresAt = new Date(Date.now() + config.flux.tokenTtlSeconds * 1000);

    const feeCents = Math.round((amount_cents * agent.feePercentBps) / 10000);

    const entry = await writeLedgerEntry({
      walletId:           wallet.id,
      walletBalanceCents: wallet.balanceCents,
      agentId:            agent.id,
      type:               "spend",
      amountCents:        amount_cents,
      description:        desc,
      payeeUrl:           payee_url,
      paymentToken:       token,
    });

    if (feeCents > 0) {
      await writeLedgerEntry({
        walletId:           wallet.id,
        walletBalanceCents: entry.balanceAfterCents,
        agentId:            agent.id,
        type:               "fee",
        amountCents:        feeCents,
        description:        `FLUX platform fee (${(agent.feePercentBps / 100).toFixed(2)}%)`,
        payeeUrl:           payee_url,
        metadata:           { baseAmountCents: amount_cents, feePercentBps: agent.feePercentBps },
      });
    }

    const [txn] = await db
      .insert(transactionRequestsTable)
      .values({
        agentId:              agent.id,
        walletId:             wallet.id,
        requestedAmountCents: amount_cents,
        payeeUrl:             payee_url,
        description:          desc,
        decision:             "approved",
        paymentToken:         token,
        tokenExpiresAt:       expiresAt,
        ledgerEntryId:        entry.id,
      })
      .returning({ id: transactionRequestsTable.id });

    // OOB Killer: check if the wallet balance has dropped to the critical
    // threshold after this spend. If so, revoke non-essential child agents to
    // preserve funds for the root agent (analogous to the OS OOM Killer).
    const oobResult = await checkAndKill(wallet.id);

    res.json({
      decision:            "approved",
      payment_token:       token,
      token_expires_at:    expiresAt.toISOString(),
      balance_after_cents: entry.balanceAfterCents - feeCents,
      fee_cents:           feeCents,
      fee_percent_bps:     agent.feePercentBps,
      transaction_id:      txn.id,
      ...(oobResult.triggered ? { oob_kill_triggered: true, oob_agents_killed: oobResult.agentsKilled } : {}),
    });
  }),
);

/**
 * GET /api/transactions
 * List transaction requests for the operator's agents (filterable).
 */
router.get(
  "/",
  userAuth,
  asyncHandler(async (req, res) => {
    const { wallet_id, agent_ids, type } = req.query;

    const agentRows = await db
      .select({ id: agentIdentitiesTable.id })
      .from(agentIdentitiesTable)
      .where(eq(agentIdentitiesTable.ownerId, req.userId as string));

    if (agentRows.length === 0) {
      res.json([]);
      return;
    }

    let agentIds = agentRows.map((a) => a.id);
    if (typeof agent_ids === "string" && agent_ids) {
      const requested = agent_ids.split(",");
      agentIds = agentIds.filter((id) => requested.includes(id));
    }

    const conditions = [inArray(transactionRequestsTable.agentId, agentIds)];
    if (typeof wallet_id === "string" && wallet_id) {
      conditions.push(eq(transactionRequestsTable.walletId, wallet_id));
    }
    if (typeof type === "string" && ["approved", "rejected"].includes(type)) {
      conditions.push(eq(transactionRequestsTable.decision, type as "approved" | "rejected"));
    }

    const txns = await db
      .select()
      .from(transactionRequestsTable)
      .where(and(...conditions))
      .orderBy(desc(transactionRequestsTable.createdAt))
      .limit(200);

    res.json(txns);
  }),
);

/**
 * GET /api/transactions/:id
 * Get a single transaction request by ID.
 */
router.get(
  "/:id",
  userAuth,
  asyncHandler(async (req, res) => {
    const agentRows = await db
      .select({ id: agentIdentitiesTable.id })
      .from(agentIdentitiesTable)
      .where(eq(agentIdentitiesTable.ownerId, req.userId as string));

    const agentIds = agentRows.map((a) => a.id);
    if (agentIds.length === 0) {
      res.status(404).json({ error: "transaction_not_found" });
      return;
    }

    const [txn] = await db
      .select()
      .from(transactionRequestsTable)
      .where(
        and(
          eq(transactionRequestsTable.id, req.params.id),
          inArray(transactionRequestsTable.agentId, agentIds),
        ),
      )
      .limit(1);

    if (!txn) {
      res.status(404).json({ error: "transaction_not_found" });
      return;
    }
    res.json(txn);
  }),
);

export default router;
