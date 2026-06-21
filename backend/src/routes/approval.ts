import { Router } from "express";
import { userAuth } from "../middleware/userAuth";
import { asyncHandler } from "../utils/asyncHandler";
import {
  listPendingApprovals,
  approveTransaction,
  rejectTransaction,
  getApprovalStats,
} from "../services/approvalQueue";

const router = Router();

/**
 * GET /api/approval/queue
 * List all transactions pending human approval.
 */
router.get(
  "/queue",
  userAuth,
  asyncHandler(async (_req, res) => {
    const items = await listPendingApprovals();
    res.json(items);
  }),
);

/**
 * GET /api/approval/stats
 * Get approval queue statistics.
 */
router.get(
  "/stats",
  userAuth,
  asyncHandler(async (_req, res) => {
    const stats = await getApprovalStats();
    res.json(stats);
  }),
);

/**
 * POST /api/approval/:transactionId/approve
 * Approve a pending transaction.
 */
router.post(
  "/:transactionId/approve",
  userAuth,
  asyncHandler(async (req, res) => {
    const { transactionId } = req.params;
    const result = await approveTransaction(transactionId, req.userId as string);
    res.json({
      approved: true,
      payment_token: result.paymentToken,
      balance_after_cents: result.balanceAfterCents,
    });
  }),
);

/**
 * POST /api/approval/:transactionId/reject
 * Reject a pending transaction.
 */
router.post(
  "/:transactionId/reject",
  userAuth,
  asyncHandler(async (req, res) => {
    const { transactionId } = req.params;
    const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
    await rejectTransaction(transactionId, req.userId as string, reason);
    res.json({ rejected: true });
  }),
);

export default router;
