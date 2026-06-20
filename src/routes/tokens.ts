import { Router } from "express";
import { store } from "../store";
import { providerAuth } from "../middleware/providerAuth";
import { TransactionDecision } from "../types";

const router = Router();

/**
 * POST /api/tokens/verify
 * A payee/paywall provider verifies a payment token before releasing content.
 * Tokens are single-use, expire quickly, and are invalidated after first use.
 * (backend-architecture.md section 2.3)
 */
router.post("/verify", providerAuth, (req, res) => {
  const { payment_token, expected_amount_cents } = req.body ?? {};
  if (typeof payment_token !== "string") {
    res.status(400).json({ valid: false, error: "missing_payment_token" });
    return;
  }

  const txn = [...store.transactions.values()].find(
    (t) =>
      t.payment_token === payment_token &&
      t.decision === TransactionDecision.Approved,
  );

  if (!txn || !txn.token_expires_at) {
    res.status(404).json({ valid: false, error: "token_not_found" });
    return;
  }

  if (new Date(txn.token_expires_at).getTime() < Date.now()) {
    res.status(410).json({ valid: false, error: "token_expired" });
    return;
  }

  if (
    typeof expected_amount_cents === "number" &&
    expected_amount_cents !== txn.requested_amount_cents
  ) {
    res.status(409).json({ valid: false, error: "amount_mismatch" });
    return;
  }

  // Single-use: invalidate the token immediately after first verification.
  txn.payment_token = null;
  store.transactions.set(txn.id, txn);

  res.json({
    valid: true,
    agent_id: txn.agent_id,
    amount_cents: txn.requested_amount_cents,
    settled_at: txn.created_at,
  });
});

export default router;
