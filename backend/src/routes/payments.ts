import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { db } from "../db";
import { agentWalletsTable, molliePaymentsTable } from "../db/schema";
import { userAuth } from "../middleware/userAuth";
import { asyncHandler } from "../utils/asyncHandler";
import { createPayment, isValidMethod, MollieStatus, processPaymentUpdate } from "../services/mollie";
import { config } from "../config/env";

const router = Router();

const MIN_DEPOSIT_CENTS = 100;
const FINAL_STATUSES: MollieStatus[] = ["paid", "failed", "expired"];

function mockCheckoutUrl(molliePaymentId: string): string {
  const base = config.flux.appUrl || "http://localhost:5173";
  return `${base.replace(/\/$/, "")}/payments/mock-checkout?payment_id=${molliePaymentId}`;
}

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
    if (typeof wallet_id !== "string" || typeof amount_cents !== "number" || amount_cents < MIN_DEPOSIT_CENTS) {
      res.status(400).json({ error: "validation_error", message: `amount_cents must be at least ${MIN_DEPOSIT_CENTS}` });
      return;
    }

    const selectedMethod = typeof method === "string" && isValidMethod(method) ? method : "ideal";

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
      amountCents: amount_cents,
      description: `FLUX wallet top-up: ${wallet.name}`,
      method:      selectedMethod,
    });

    await db.insert(molliePaymentsTable).values({
      userId:          req.userId as string,
      walletId:        wallet_id,
      molliePaymentId: result.molliePaymentId,
      amountCents:     amount_cents,
      currency:        "EUR",
      method:          selectedMethod,
      status:          result.status,
      checkoutUrl:     result.checkoutUrl,
    });

    res.status(201).json({
      mollie_payment_id: result.molliePaymentId,
      checkout_url:      result.checkoutUrl,
      amount_cents:      amount_cents,
      wallet_id:         wallet_id,
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

/**
 * POST /api/payments/mock-deposit
 * Creates a local-only Mollie payment record for UI testing without a real API key.
 * Returns a checkout URL that points to the in-app mock checkout page.
 */
router.post(
  "/mock-deposit",
  userAuth,
  asyncHandler(async (req, res) => {
    const { wallet_id, amount_cents, method } = req.body ?? {};
    if (typeof wallet_id !== "string" || typeof amount_cents !== "number" || amount_cents < MIN_DEPOSIT_CENTS) {
      res.status(400).json({ error: "validation_error", message: `amount_cents must be at least ${MIN_DEPOSIT_CENTS}` });
      return;
    }

    const selectedMethod = typeof method === "string" && isValidMethod(method) ? method : "ideal";
    const molliePaymentId = `tr_${uuidv4().replace(/-/g, "").slice(0, 10)}`;

    const [wallet] = await db
      .select({ id: agentWalletsTable.id, name: agentWalletsTable.name, ownerId: agentWalletsTable.ownerId })
      .from(agentWalletsTable)
      .where(and(eq(agentWalletsTable.id, wallet_id), eq(agentWalletsTable.ownerId, req.userId as string)))
      .limit(1);

    if (!wallet) {
      res.status(404).json({ error: "wallet_not_found" });
      return;
    }

    await db.insert(molliePaymentsTable).values({
      userId:          req.userId as string,
      walletId:        wallet_id,
      molliePaymentId: molliePaymentId,
      amountCents:     amount_cents,
      currency:        "EUR",
      method:          selectedMethod,
      status:          "open",
      checkoutUrl:     mockCheckoutUrl(molliePaymentId),
    });

    res.status(201).json({
      mollie_payment_id: molliePaymentId,
      checkout_url:      mockCheckoutUrl(molliePaymentId),
      amount_cents:      amount_cents,
      wallet_id:         wallet_id,
      mock:              true,
    });
  }),
);

/**
 * POST /api/payments/mock-webhook/:mollie_payment_id
 * Simulates a Mollie webhook call for a mock payment. The UI calls this when the
 * user clicks Pay / Fail / Cancel in the mock checkout page.
 */
router.post(
  "/mock-webhook/:mollie_payment_id",
  userAuth,
  asyncHandler(async (req, res) => {
    const { mollie_payment_id } = req.params;
    const { status } = req.body ?? {};

    if (!FINAL_STATUSES.includes(status as MollieStatus)) {
      res.status(400).json({ error: "invalid_status", allowed: FINAL_STATUSES });
      return;
    }

    const [record] = await db
      .select({ userId: molliePaymentsTable.userId })
      .from(molliePaymentsTable)
      .where(eq(molliePaymentsTable.molliePaymentId, mollie_payment_id))
      .limit(1);

    if (!record || record.userId !== req.userId) {
      res.status(404).json({ error: "payment_not_found" });
      return;
    }

    await processPaymentUpdate(mollie_payment_id, status as MollieStatus);
    res.json({ received: true, status });
  }),
);

export default router;
