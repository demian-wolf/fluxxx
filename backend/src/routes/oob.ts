import { Router } from "express";
import { userAuth } from "../middleware/userAuth";
import { asyncHandler } from "../utils/asyncHandler";
import { getOobStatus, listOobKillEvents, checkAndKill } from "../services/oobKiller";

const router = Router();

/**
 * GET /api/oob/status
 * Aggregate OOB Killer statistics.
 */
router.get(
  "/status",
  userAuth,
  asyncHandler(async (_req, res) => {
    const status = await getOobStatus();
    res.json(status);
  }),
);

/**
 * GET /api/oob/events
 * Full history of OOB kill events, newest first.
 */
router.get(
  "/events",
  userAuth,
  asyncHandler(async (_req, res) => {
    const events = await listOobKillEvents();
    res.json(events);
  }),
);

/**
 * POST /api/oob/simulate
 * Manually trigger an OOB check on a specific wallet. Useful for testing.
 * Accepts `wallet_id` and optional `threshold_cents` in the body.
 */
router.post(
  "/simulate",
  userAuth,
  asyncHandler(async (req, res) => {
    const { wallet_id, threshold_cents } = req.body ?? {};
    if (typeof wallet_id !== "string") {
      res.status(400).json({ error: "missing_wallet_id" });
      return;
    }
    const threshold = typeof threshold_cents === "number" ? threshold_cents : undefined;
    const result = await checkAndKill(wallet_id, threshold);
    res.json(result);
  }),
);

export default router;
