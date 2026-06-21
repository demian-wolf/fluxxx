import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { getPayment, processPaymentUpdate } from "../services/mollie";

const router = Router();

/**
 * POST /api/webhooks/mollie
 * Mollie notifies FLUX of a payment status change. The payment is always
 * re-fetched from Mollie directly (anti-spoofing). On `paid`, a deposit ledger
 * entry is written and the wallet balance is credited.
 * (backend-architecture.md section 2.5)
 */
router.post(
  "/mollie",
  asyncHandler(async (req, res) => {
    const molliePaymentId: unknown = req.body?.id;
    if (typeof molliePaymentId !== "string") {
      res.status(400).json({ error: "missing_payment_id" });
      return;
    }

    const remote = await getPayment(molliePaymentId);
    await processPaymentUpdate(molliePaymentId, remote.status);

    res.status(200).json({ received: true });
  }),
);

export default router;
