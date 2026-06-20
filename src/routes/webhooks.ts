import { Router } from "express";
import { store } from "../store";
import { asyncHandler } from "../utils/asyncHandler";
import { getPayment } from "../services/mollie";
import { writeLedgerEntry } from "../services/ledger";
import { LedgerEntryType, MolliePaymentStatus } from "../types";

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

    const record = [...store.molliePayments.values()].find(
      (p) => p.mollie_payment_id === molliePaymentId,
    );
    if (!record) {
      // Acknowledge to stop retries even if we don't recognise the payment.
      res.status(200).json({ received: true });
      return;
    }

    const remote = await getPayment(molliePaymentId);
    record.webhook_received_at = new Date().toISOString();

    if (remote.status === MolliePaymentStatus.Paid) {
      if (record.status !== MolliePaymentStatus.Paid) {
        record.status = MolliePaymentStatus.Paid;
        const wallet = store.wallets.get(record.wallet_id);
        if (wallet) {
          writeLedgerEntry({
            wallet,
            agentId: null,
            type: LedgerEntryType.Deposit,
            amountCents: record.amount_cents,
            description: "Mollie deposit",
            molliePaymentId,
          });
        }
      }
    } else if (
      remote.status === MolliePaymentStatus.Failed ||
      remote.status === MolliePaymentStatus.Expired
    ) {
      record.status = remote.status;
    }

    store.molliePayments.set(record.id, record);
    res.status(200).json({ received: true });
  }),
);

export default router;
