import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { store, findActivePolicy } from "../store";
import { agentAuth } from "../middleware/agentAuth";
import { evaluate } from "../services/policyEngine";
import { writeLedgerEntry } from "../services/ledger";
import { generatePaymentToken } from "../services/auth";
import { config } from "../config/env";
import { TransactionRequest } from "../models";
import {
  LedgerEntryType,
  RejectionReason,
  TransactionDecision,
} from "../types";

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
router.post("/request", agentAuth, (req, res) => {
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

  const agent = store.agents.get(session.sub);
  const wallet = store.wallets.get(session.wallet_id);
  if (!agent || !wallet) {
    res.status(404).json({ error: "agent_or_wallet_not_found" });
    return;
  }

  const policy = findActivePolicy(agent.id);
  const result = evaluate({
    agent,
    wallet,
    policy,
    amountCents: amount_cents,
    payeeUrl: payee_url,
    description: typeof description === "string" ? description : "",
  });

  const now = new Date().toISOString();
  const txn: TransactionRequest = {
    id: uuidv4(),
    agent_id: agent.id,
    wallet_id: wallet.id,
    requested_amount_cents: amount_cents,
    payee_url,
    description: typeof description === "string" ? description : "",
    decision: TransactionDecision.Pending,
    rejection_reason: null,
    payment_token: null,
    token_expires_at: null,
    ledger_entry_id: null,
    created_at: now,
  };

  if (!result.approved) {
    txn.decision = TransactionDecision.Rejected;
    txn.rejection_reason = result.reason;
    store.transactions.set(txn.id, txn);

    res.status(402).json({
      decision: "rejected",
      rejection_reason: result.reason,
      ...(result.details ?? {}),
      ...(retryAfterSeconds(result.reason) !== undefined
        ? { retry_after_seconds: retryAfterSeconds(result.reason) }
        : {}),
    });
    return;
  }

  // Approved: atomically deduct balance, write ledger entry, issue token.
  const token = generatePaymentToken();
  const expiresAt = new Date(
    Date.now() + config.flux.tokenTtlSeconds * 1000,
  ).toISOString();

  const entry = writeLedgerEntry({
    wallet,
    agentId: agent.id,
    type: LedgerEntryType.Spend,
    amountCents: amount_cents,
    description: txn.description,
    payeeUrl: payee_url,
    paymentToken: token,
  });

  txn.decision = TransactionDecision.Approved;
  txn.payment_token = token;
  txn.token_expires_at = expiresAt;
  txn.ledger_entry_id = entry.id;
  store.transactions.set(txn.id, txn);

  res.json({
    decision: "approved",
    payment_token: token,
    token_expires_at: expiresAt,
    balance_after_cents: entry.balance_after_cents,
    transaction_id: txn.id,
  });
});

export default router;
