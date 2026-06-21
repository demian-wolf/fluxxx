import { Router } from "express";
import { userAuth } from "../middleware/userAuth";
import { asyncHandler } from "../utils/asyncHandler";
import { calculateReputation, calculateAllReputations } from "../services/reputation";

const router = Router();

/**
 * GET /api/reputation
 * Get reputation scores for all agents.
 */
router.get(
  "/",
  userAuth,
  asyncHandler(async (_req, res) => {
    const scores = await calculateAllReputations();
    res.json(scores);
  }),
);

/**
 * GET /api/reputation/:agentId
 * Get reputation score for a specific agent.
 */
router.get(
  "/:agentId",
  userAuth,
  asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const score = await calculateReputation(agentId);
    res.json(score);
  }),
);

export default router;
