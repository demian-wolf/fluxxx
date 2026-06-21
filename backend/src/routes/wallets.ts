import { Router } from "express";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { agentIdentitiesTable, agentWalletsTable, ledgerEntriesTable } from "../db/schema";
import { userAuth } from "../middleware/userAuth";
import { spentInWindow } from "../services/ledger";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS  = 24 * ONE_HOUR_MS;

/**
 * POST /api/wallets
 * Operator creates a new agent wallet.
 */
router.post(
  "/",
  userAuth,
  asyncHandler(async (req, res) => {
    const { name } = req.body ?? {};
    if (typeof name !== "string" || name.trim() === "") {
      res.status(400).json({ error: "missing_name" });
      return;
    }

    const [wallet] = await db
      .insert(agentWalletsTable)
      .values({
        ownerId: req.userId as string,
        name:    name.trim(),
      })
      .returning();

    res.status(201).json(wallet);
  }),
);

/**
 * GET /api/wallets
 * List all wallets for the authenticated operator.
 */
router.get(
  "/",
  userAuth,
  asyncHandler(async (req, res) => {
    const wallets = await db
      .select()
      .from(agentWalletsTable)
      .where(eq(agentWalletsTable.ownerId, req.userId as string));

    res.json({ wallets });
  }),
);

/**
 * GET /api/wallets/:wallet_id
 * Get a single wallet by ID (must belong to authenticated operator).
 */
router.get(
  "/:wallet_id",
  userAuth,
  asyncHandler(async (req, res) => {
    const [wallet] = await db
      .select()
      .from(agentWalletsTable)
      .where(and(eq(agentWalletsTable.id, req.params.wallet_id), eq(agentWalletsTable.ownerId, req.userId as string)))
      .limit(1);

    if (!wallet) {
      res.status(404).json({ error: "wallet_not_found" });
      return;
    }
    res.json(wallet);
  }),
);

/**
 * PATCH /api/wallets/:wallet_id
 * Update wallet status (active | suspended | depleted).
 */
router.patch(
  "/:wallet_id",
  userAuth,
  asyncHandler(async (req, res) => {
    const { status } = req.body ?? {};
    const allowed = ["active", "suspended", "depleted"];
    if (typeof status !== "string" || !allowed.includes(status)) {
      res.status(400).json({ error: "invalid_status" });
      return;
    }

    const [wallet] = await db
      .select({ id: agentWalletsTable.id, ownerId: agentWalletsTable.ownerId })
      .from(agentWalletsTable)
      .where(and(eq(agentWalletsTable.id, req.params.wallet_id), eq(agentWalletsTable.ownerId, req.userId as string)))
      .limit(1);

    if (!wallet) {
      res.status(404).json({ error: "wallet_not_found" });
      return;
    }

    const [updated] = await db
      .update(agentWalletsTable)
      .set({ status: status as "active" | "suspended" | "depleted", updatedAt: new Date() })
      .where(eq(agentWalletsTable.id, wallet.id))
      .returning();

    res.json(updated);
  }),
);

/**
 * GET /api/wallets/:wallet_id/ledger
 * Paginated ledger entries for a wallet.
 */
router.get(
  "/:wallet_id/ledger",
  userAuth,
  asyncHandler(async (req, res) => {
    const walletId = req.params.wallet_id;

    const [wallet] = await db
      .select({ id: agentWalletsTable.id })
      .from(agentWalletsTable)
      .where(and(eq(agentWalletsTable.id, walletId), eq(agentWalletsTable.ownerId, req.userId as string)))
      .limit(1);

    if (!wallet) {
      res.status(404).json({ error: "wallet_not_found" });
      return;
    }

    const entries = await db
      .select()
      .from(ledgerEntriesTable)
      .where(eq(ledgerEntriesTable.walletId, walletId))
      .orderBy(desc(ledgerEntriesTable.createdAt))
      .limit(100);

    res.json(entries);
  }),
);

/**
 * GET /api/wallets/:wallet_id/spend-series
 * Daily spend totals for charting (last 30 days).
 */
router.get(
  "/:wallet_id/spend-series",
  userAuth,
  asyncHandler(async (req, res) => {
    const walletId = req.params.wallet_id;

    const [wallet] = await db
      .select({ id: agentWalletsTable.id })
      .from(agentWalletsTable)
      .where(and(eq(agentWalletsTable.id, walletId), eq(agentWalletsTable.ownerId, req.userId as string)))
      .limit(1);

    if (!wallet) {
      res.status(404).json({ error: "wallet_not_found" });
      return;
    }

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        date: sql<string>`date_trunc('day', ${ledgerEntriesTable.createdAt})::date`,
        total: sql<number>`coalesce(sum(${ledgerEntriesTable.amountCents}), 0)`,
      })
      .from(ledgerEntriesTable)
      .where(
        and(
          eq(ledgerEntriesTable.walletId, walletId),
          eq(ledgerEntriesTable.type, "spend"),
          gte(ledgerEntriesTable.createdAt, cutoff),
        ),
      )
      .groupBy(sql`date_trunc('day', ${ledgerEntriesTable.createdAt})::date`)
      .orderBy(sql`date_trunc('day', ${ledgerEntriesTable.createdAt})::date`);

    res.json(rows.map((r) => ({ date: r.date, amount_cents: Number(r.total) })));
  }),
);

/**
 * GET /api/wallets/:wallet_id/analytics
 * Per-wallet and per-agent spend analytics for the operator dashboard.
 * (backend-architecture.md section 2.7)
 */
router.get(
  "/:wallet_id/analytics",
  userAuth,
  asyncHandler(async (req, res) => {
    const walletId = req.params.wallet_id;

    const [wallet] = await db
      .select()
      .from(agentWalletsTable)
      .where(and(eq(agentWalletsTable.id, walletId), eq(agentWalletsTable.ownerId, req.userId as string)))
      .limit(1);

    if (!wallet) {
      res.status(404).json({ error: "wallet_not_found" });
      return;
    }

    const [{ totalDeposited }] = await db
      .select({ totalDeposited: sql<number>`coalesce(sum(${ledgerEntriesTable.amountCents}), 0)` })
      .from(ledgerEntriesTable)
      .where(and(eq(ledgerEntriesTable.walletId, walletId), eq(ledgerEntriesTable.type, "deposit")));

    const [{ totalSpent }] = await db
      .select({ totalSpent: sql<number>`coalesce(sum(${ledgerEntriesTable.amountCents}), 0)` })
      .from(ledgerEntriesTable)
      .where(and(eq(ledgerEntriesTable.walletId, walletId), eq(ledgerEntriesTable.type, "spend")));

    const agentRows = await db
      .select()
      .from(agentIdentitiesTable)
      .where(eq(agentIdentitiesTable.walletId, walletId));

    const agentStats = await Promise.all(
      agentRows.map(async (a) => {
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(ledgerEntriesTable)
          .where(and(eq(ledgerEntriesTable.agentId, a.id), eq(ledgerEntriesTable.type, "spend")));

        const [lastTx] = await db
          .select({ createdAt: ledgerEntriesTable.createdAt })
          .from(ledgerEntriesTable)
          .where(and(eq(ledgerEntriesTable.agentId, a.id), eq(ledgerEntriesTable.type, "spend")))
          .orderBy(desc(ledgerEntriesTable.createdAt))
          .limit(1);

        return {
          agent_id:              a.id,
          name:                  a.name,
          spent_last_hour_cents: await spentInWindow(walletId, a.id, ONE_HOUR_MS),
          spent_today_cents:     await spentInWindow(walletId, a.id, ONE_DAY_MS),
          transaction_count:     Number(count),
          last_tx_at:            lastTx?.createdAt ?? null,
        };
      }),
    );

    const recentTransactions = await db
      .select()
      .from(ledgerEntriesTable)
      .where(eq(ledgerEntriesTable.walletId, walletId))
      .orderBy(desc(ledgerEntriesTable.createdAt))
      .limit(10);

    res.json({
      wallet_id:             walletId,
      balance_cents:         wallet.balanceCents,
      total_deposited_cents: Number(totalDeposited),
      total_spent_cents:     Number(totalSpent),
      agents:                agentStats,
      recent_transactions:   recentTransactions,
    });
  }),
);

export default router;
