import { Router } from "express";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "../db";
import { transactionRequestsTable } from "../db/schema";
import { providerAuth } from "../middleware/providerAuth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

/**
 * POST /api/tokens/verify
 * A payee/paywall provider verifies a payment token before releasing content.
 * Tokens are single-use, expire quickly, and are invalidated after first use.
 * (backend-architecture.md section 2.3)
 */
router.post(
  "/verify",
  providerAuth,
  asyncHandler(async (req, res) => {
    const { payment_token, expected_amount_cents } = req.body ?? {};
    if (typeof payment_token !== "string") {
      res.status(400).json({ valid: false, error: "missing_payment_token" });
      return;
    }

    const [txn] = await db
      .select()
      .from(transactionRequestsTable)
      .where(
        and(
          eq(transactionRequestsTable.paymentToken, payment_token),
          eq(transactionRequestsTable.decision, "approved"),
          isNotNull(transactionRequestsTable.paymentToken),
        ),
      )
      .limit(1);

    if (!txn || !txn.tokenExpiresAt) {
      res.status(404).json({ valid: false, error: "token_not_found" });
      return;
    }

    if (txn.tokenExpiresAt.getTime() < Date.now()) {
      res.status(410).json({ valid: false, error: "token_expired" });
      return;
    }

    if (
      typeof expected_amount_cents === "number" &&
      expected_amount_cents !== txn.requestedAmountCents
    ) {
      res.status(409).json({ valid: false, error: "amount_mismatch" });
      return;
    }

    // Single-use: nullify the token immediately after first verification.
    await db
      .update(transactionRequestsTable)
      .set({ paymentToken: null })
      .where(eq(transactionRequestsTable.id, txn.id));

    res.json({
      valid:        true,
      agent_id:     txn.agentId,
      amount_cents: txn.requestedAmountCents,
      settled_at:   txn.createdAt,
    });
  }),
);

export default router;
