import { Router } from "express";
import { userAuth } from "../middleware/userAuth";
import { asyncHandler } from "../utils/asyncHandler";
import { forecastDepletion } from "../services/forecasting";

const router = Router();

/**
 * GET /api/forecasting/:walletId
 * Get depletion forecast for a wallet.
 */
router.get(
  "/:walletId",
  userAuth,
  asyncHandler(async (req, res) => {
    const { walletId } = req.params;
    const windowHours = typeof req.query.window_hours === "string"
      ? parseInt(req.query.window_hours, 10)
      : undefined;

    const forecast = await forecastDepletion(walletId, windowHours);
    res.json(forecast);
  }),
);

export default router;
