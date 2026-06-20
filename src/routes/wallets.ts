import { Router } from "express";
import { store, ledgerForWallet } from "../store";
import { userAuth } from "../middleware/userAuth";
import { spentInWindow } from "../services/ledger";
import { LedgerEntryType } from "../types";

const router = Router();

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

/**
 * GET /api/wallets/:wallet_id/analytics
 * Per-wallet and per-agent spend analytics for the operator dashboard.
 * (backend-architecture.md section 2.7)
 */
router.get("/:wallet_id/analytics", userAuth, (req, res) => {
  const walletId = req.params.wallet_id;
  const wallet = store.wallets.get(walletId);
  if (!wallet) {
    res.status(404).json({ error: "wallet_not_found" });
    return;
  }

  const entries = ledgerForWallet(walletId);
  const totalDeposited = entries
    .filter((e) => e.type === LedgerEntryType.Deposit)
    .reduce((sum, e) => sum + e.amount_cents, 0);
  const totalSpent = entries
    .filter((e) => e.type === LedgerEntryType.Spend)
    .reduce((sum, e) => sum + e.amount_cents, 0);

  const agents = [...store.agents.values()]
    .filter((a) => a.wallet_id === walletId)
    .map((a) => {
      const agentTxns = entries.filter(
        (e) => e.agent_id === a.id && e.type === LedgerEntryType.Spend,
      );
      const last = agentTxns[agentTxns.length - 1];
      return {
        agent_id: a.id,
        name: a.name,
        spent_last_hour_cents: spentInWindow(walletId, a.id, ONE_HOUR_MS),
        spent_today_cents: spentInWindow(walletId, a.id, ONE_DAY_MS),
        transaction_count: agentTxns.length,
        last_tx_at: last?.created_at ?? null,
      };
    });

  res.json({
    wallet_id: walletId,
    balance_cents: wallet.balance_cents,
    total_deposited_cents: totalDeposited,
    total_spent_cents: totalSpent,
    agents,
    recent_transactions: entries.slice(-10).reverse(),
  });
});

export default router;
