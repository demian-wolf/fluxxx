import { Router } from "express";
import { userAuth } from "../middleware/userAuth";
import { asyncHandler } from "../utils/asyncHandler";
import { listPlugins, removePlugin } from "../services/policyPlugins";

const router = Router();

/**
 * GET /api/plugins
 * List all registered policy plugins.
 */
router.get(
  "/",
  userAuth,
  asyncHandler(async (_req, res) => {
    const plugins = listPlugins();
    // Don't expose the evaluate function in the API response
    const safe = plugins.map(({ evaluate: _evaluate, ...rest }) => rest);
    res.json(safe);
  }),
);

/**
 * PATCH /api/plugins/:id
 * Enable/disable a plugin or update its config.
 */
router.patch(
  "/:id",
  userAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const plugins = listPlugins();
    const existing = plugins.find((p) => p.id === id);

    if (!existing) {
      res.status(404).json({ error: "plugin_not_found" });
      return;
    }

    const { enabled, config } = req.body ?? {};

    if (typeof enabled === "boolean") {
      existing.enabled = enabled;
    }
    if (config && typeof config === "object") {
      existing.config = { ...existing.config, ...config };
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { evaluate: _evaluate, ...safe } = existing;
    res.json(safe);
  }),
);

/**
 * DELETE /api/plugins/:id
 * Remove a custom plugin (cannot remove built-in plugins).
 */
router.delete(
  "/:id",
  userAuth,
  asyncHandler(async (req, res) => {
    const builtInIds = ["time_restriction", "anomaly_detector", "category_budget", "velocity_limit"];
    if (builtInIds.includes(req.params.id)) {
      res.status(403).json({ error: "cannot_remove_builtin_plugin" });
      return;
    }
    const removed = removePlugin(req.params.id);
    if (!removed) {
      res.status(404).json({ error: "plugin_not_found" });
      return;
    }
    res.json({ removed: true });
  }),
);

export default router;
