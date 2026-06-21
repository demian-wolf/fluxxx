import { Router } from "express";
import { userAuth } from "../middleware/userAuth";
import { asyncHandler } from "../utils/asyncHandler";
import {
  registerWebhook,
  removeWebhook,
  listWebhooks,
  getDeliveryLog,
} from "../services/alerts";
import type { AlertEventType } from "../services/alerts";

const router = Router();

/**
 * GET /api/alerts/webhooks
 * List all registered webhook endpoints.
 */
router.get(
  "/webhooks",
  userAuth,
  asyncHandler(async (_req, res) => {
    const webhooks = listWebhooks();
    res.json(webhooks);
  }),
);

/**
 * POST /api/alerts/webhooks
 * Register a new webhook endpoint.
 */
router.post(
  "/webhooks",
  userAuth,
  asyncHandler(async (req, res) => {
    const { url, secret, events, enabled } = req.body ?? {};
    if (typeof url !== "string" || !Array.isArray(events)) {
      res.status(400).json({ error: "missing_required_fields" });
      return;
    }

    const webhook = registerWebhook({
      url,
      secret: typeof secret === "string" ? secret : "",
      events: events as AlertEventType[],
      enabled: enabled !== false,
    });
    res.status(201).json(webhook);
  }),
);

/**
 * DELETE /api/alerts/webhooks/:id
 * Remove a webhook endpoint.
 */
router.delete(
  "/webhooks/:id",
  userAuth,
  asyncHandler(async (req, res) => {
    const removed = removeWebhook(req.params.id);
    if (!removed) {
      res.status(404).json({ error: "webhook_not_found" });
      return;
    }
    res.json({ removed: true });
  }),
);

/**
 * GET /api/alerts/deliveries
 * Get recent webhook delivery log.
 */
router.get(
  "/deliveries",
  userAuth,
  asyncHandler(async (req, res) => {
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
    const deliveries = getDeliveryLog(limit);
    res.json(deliveries);
  }),
);

export default router;
