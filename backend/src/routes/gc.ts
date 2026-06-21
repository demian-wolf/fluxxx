import { Router } from "express";
import { userAuth } from "../middleware/userAuth";
import { asyncHandler } from "../utils/asyncHandler";
import { sweep, listGcEvents, getGcStatus } from "../services/capitalReclamation";

const router = Router();

/**
 * GET /api/gc/status
 * Aggregate GC statistics: total events, total reclaimed, last sweep time.
 */
router.get(
  "/status",
  userAuth,
  asyncHandler(async (_req, res) => {
    const status = await getGcStatus();
    res.json(status);
  }),
);

/**
 * GET /api/gc/events
 * Full history of capital reclamation events, newest first.
 */
router.get(
  "/events",
  userAuth,
  asyncHandler(async (_req, res) => {
    const events = await listGcEvents();
    res.json(events);
  }),
);

/**
 * POST /api/gc/sweep
 * Manually trigger a capital reclamation sweep. Accepts an optional
 * `ttl_ms` body parameter to override the default zombie TTL.
 */
router.post(
  "/sweep",
  userAuth,
  asyncHandler(async (req, res) => {
    const ttlMs = typeof req.body?.ttl_ms === "number" ? req.body.ttl_ms : undefined;
    const result = await sweep(ttlMs);
    res.json({
      zombies_found: result.zombiesFound,
      events_created: result.eventsCreated.length,
      total_reclaimed_cents: result.totalReclaimedCents,
      total_limit_freed: result.totalLimitFreed,
      events: result.eventsCreated,
    });
  }),
);

export default router;
