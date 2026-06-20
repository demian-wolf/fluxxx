import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { store } from "../store";
import { userAuth } from "../middleware/userAuth";
import { asyncHandler } from "../utils/asyncHandler";
import { createPayment } from "../services/mollie";
import { MolliePayment } from "../models";
import { MolliePaymentStatus } from "../types";

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
    if (typeof wallet_id !== "string" || typeof amount_cents !== "number") {
      res.status(400).json({ error: "missing_required_fields" });
      return;
    }

    const wallet = store.wallets.get(wallet_id);
    if (!wallet) {
      res.status(404).json({ error: "wallet_not_found" });
      return;
    }

    const result = await createPayment({
      amountCents: amount_cents,
      description: `FLUX wallet top-up: ${wallet.name}`,
    });

    const record: MolliePayment = {
      id: uuidv4(),
      user_id: req.userId as string,
      wallet_id,
      mollie_payment_id: result.molliePaymentId,
      amount_cents,
      currency: "EUR",
      method: typeof method === "string" ? method : "ideal",
      status: MolliePaymentStatus.Open,
      checkout_url: result.checkoutUrl,
      webhook_received_at: null,
      created_at: new Date().toISOString(),
    };
    store.molliePayments.set(record.id, record);

    res.status(201).json({
      mollie_payment_id: result.molliePaymentId,
      checkout_url: result.checkoutUrl,
      expires_at: result.expiresAt,
    });
  }),
);

export default router;
