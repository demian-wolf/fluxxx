import { Router } from "express";
import { and, eq } from "drizzle-orm";

import { db } from "../db";
import { agentWalletsTable, molliePaymentsTable } from "../db/schema";
import { userAuth } from "../middleware/userAuth";
import { asyncHandler } from "../utils/asyncHandler";
import { createPayment } from "../services/mollie";

const router = Router();

/**
 * POST /api/payments/deposit
 * Operator initiates a wallet top-up via Mollie hosted checkout.
 * (backend-architecture.md section 2.4)
 */
router.post(
  "/deposit",
  userAuth,
  asyncHandler(async (req, res) => {
    const { wallet_id, amount_cents, method } = req.body ?? {};
    if (typeof wallet_id !== "string" || typeof amount_cents !== "number" || amount_cents <= 0) {
      res.status(400).json({ error: "missing_required_fields" });
      return;
    }

    const [wallet] = await db
      .select({ id: agentWalletsTable.id, name: agentWalletsTable.name, ownerId: agentWalletsTable.ownerId })
      .from(agentWalletsTable)
      .where(and(eq(agentWalletsTable.id, wallet_id), eq(agentWalletsTable.ownerId, req.userId as string)))
      .limit(1);

    if (!wallet) {
      res.status(404).json({ error: "wallet_not_found" });
      return;
    }

    const result = await createPayment({
      amountCents:  amount_cents,
      description:  `FLUX wallet top-up: ${wallet.name}`,
    });

    await db.insert(molliePaymentsTable).values({
      userId:          req.userId as string,
      walletId:        wallet_id,
      molliePaymentId: result.molliePaymentId,
      amountCents:     amount_cents,
      currency:        "EUR",
      method:          typeof method === "string" ? method : "ideal",
      status:          "open",
      checkoutUrl:     result.checkoutUrl,
    });

    res.status(201).json({
      mollie_payment_id: result.molliePaymentId,
      checkout_url:      result.checkoutUrl,
      expires_at:        result.expiresAt,
    });
  }),
);

/**
 * GET /api/payments/:mollie_payment_id/status
 * Fetch the status of a Mollie payment record.
 */
router.get(
  "/:mollie_payment_id/status",
  userAuth,
  asyncHandler(async (req, res) => {
    const [record] = await db
      .select()
      .from(molliePaymentsTable)
      .where(
        and(
          eq(molliePaymentsTable.molliePaymentId, req.params.mollie_payment_id),
          eq(molliePaymentsTable.userId, req.userId as string),
        ),
      )
      .limit(1);

    if (!record) {
      res.status(404).json({ error: "payment_not_found" });
      return;
    }
    res.json(record);
  }),
);

export default router;
