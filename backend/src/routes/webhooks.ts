import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { agentWalletsTable, molliePaymentsTable } from "../db/schema";
import { asyncHandler } from "../utils/asyncHandler";
import { getPayment } from "../services/mollie";
import { writeLedgerEntry } from "../services/ledger";

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

    const [record] = await db
      .select()
      .from(molliePaymentsTable)
      .where(eq(molliePaymentsTable.molliePaymentId, molliePaymentId))
      .limit(1);

    if (!record) {
      // Acknowledge to stop retries even if we don't recognise the payment.
      res.status(200).json({ received: true });
      return;
    }

    const remote = await getPayment(molliePaymentId);
    const now = new Date();

    if (remote.status === "paid" && record.status !== "paid") {
      const [wallet] = await db
        .select({ id: agentWalletsTable.id, balanceCents: agentWalletsTable.balanceCents })
        .from(agentWalletsTable)
        .where(eq(agentWalletsTable.id, record.walletId))
        .limit(1);

      if (wallet) {
        await writeLedgerEntry({
          walletId:           wallet.id,
          walletBalanceCents: wallet.balanceCents,
          agentId:            null,
          type:               "deposit",
          amountCents:        record.amountCents,
          description:        "Mollie deposit",
          molliePaymentId,
        });
      }

      await db
        .update(molliePaymentsTable)
        .set({ status: "paid", webhookReceivedAt: now })
        .where(eq(molliePaymentsTable.id, record.id));
    } else if (remote.status === "failed" || remote.status === "expired") {
      await db
        .update(molliePaymentsTable)
        .set({ status: remote.status, webhookReceivedAt: now })
        .where(eq(molliePaymentsTable.id, record.id));
    } else {
      await db
        .update(molliePaymentsTable)
        .set({ webhookReceivedAt: now })
        .where(eq(molliePaymentsTable.id, record.id));
    }

    res.status(200).json({ received: true });
  }),
);

export default router;
