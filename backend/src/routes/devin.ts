import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { agentIdentitiesTable, agentWalletsTable, spendPoliciesTable } from "../db/schema";
import { generateAgentApiKey, hashApiKey } from "../services/auth";
import { userAuth } from "../middleware/userAuth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

/**
 * POST /api/devin/launch
 * Launch a governed Devin session: create a FLUX AgentIdentity, then return
 * credentials the operator (or an orchestration layer) can inject into a
 * Devin session prompt via the Devin API.
 */
router.post(
  "/launch",
  userAuth,
  asyncHandler(async (req, res) => {
    const {
      wallet_id,
      task,
      agent_name,
      per_tx_limit_cents,
      hourly_limit_cents,
      daily_limit_cents,
      allowed_domains,
    } = req.body ?? {};

    if (typeof wallet_id !== "string" || typeof task !== "string" || !task.trim()) {
      res.status(400).json({ error: "missing_required_fields" });
      return;
    }

    const [wallet] = await db
      .select()
      .from(agentWalletsTable)
      .where(eq(agentWalletsTable.id, wallet_id))
      .limit(1);

    if (!wallet) {
      res.status(404).json({ error: "wallet_not_found" });
      return;
    }
    if (wallet.ownerId !== req.userId) {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    const label = typeof agent_name === "string" && agent_name.trim()
      ? `Devin \u2014 ${agent_name.trim()}`
      : "Devin Agent";

    const rawKey    = generateAgentApiKey();
    const apiKeyHash = hashApiKey(rawKey);

    const [agent] = await db
      .insert(agentIdentitiesTable)
      .values({
        walletId:         wallet_id,
        ownerId:          req.userId as string,
        name:             label,
        apiKeyHash,
        hourlyLimitCents: Number(hourly_limit_cents ?? 200),
        perTxLimitCents:  Number(per_tx_limit_cents ?? 10),
        dailyLimitCents:  Number(daily_limit_cents ?? 1000),
        allowedDomains:   Array.isArray(allowed_domains) ? allowed_domains : undefined,
      })
      .returning();

    await db
      .insert(spendPoliciesTable)
      .values({
        agentId:   agent.id,
        version:   1,
        rules: {
          hourly_limit_cents: agent.hourlyLimitCents,
          per_tx_limit_cents: agent.perTxLimitCents,
          daily_limit_cents:  agent.dailyLimitCents,
          allowed_domains:    agent.allowedDomains ?? [],
          require_description: true,
          auto_suspend_on_anomaly: true,
        },
        isActive:  true,
        createdBy: req.userId as string,
      });

    res.status(201).json({
      agent_id:    agent.id,
      agent_name:  label,
      wallet_id:   wallet.id,
      wallet_name: wallet.name,
      api_key:     rawKey,
      task,
      limits: {
        per_tx_limit_cents:  agent.perTxLimitCents,
        hourly_limit_cents:  agent.hourlyLimitCents,
        daily_limit_cents:   agent.dailyLimitCents,
      },
      flux_api_base_url: process.env.FLUX_APP_URL || "http://localhost:3000",
      instructions: [
        `You have been provisioned a FLUX AgentIdentity with API key: ${rawKey}`,
        `Authenticate at POST /api/auth/agent with {"agent_api_key": "<your key>"}`,
        `Request spend at POST /api/transactions/request with your session token`,
        `Your spend limits: per_tx=${agent.perTxLimitCents}c, hourly=${agent.hourlyLimitCents}c, daily=${agent.dailyLimitCents}c`,
        `If a transaction is rejected (HTTP 402), report the rejection_reason to the operator.`,
      ],
      warning: "Store this key securely. It will not be shown again.",
    });
  }),
);

/**
 * POST /api/devin/sessions/:id/escalate
 * Operator approves a budget escalation for a running Devin agent.
 */
router.post(
  "/sessions/:id/escalate",
  userAuth,
  asyncHandler(async (req, res) => {
    const agentId = req.params.id;
    const { new_limit_cents, limit_field } = req.body ?? {};

    const validFields = ["per_tx_limit_cents", "hourly_limit_cents", "daily_limit_cents"];
    if (typeof new_limit_cents !== "number" || !validFields.includes(limit_field)) {
      res.status(400).json({ error: "invalid_escalation" });
      return;
    }

    const [agent] = await db
      .select()
      .from(agentIdentitiesTable)
      .where(and(eq(agentIdentitiesTable.id, agentId), eq(agentIdentitiesTable.ownerId, req.userId as string)))
      .limit(1);

    if (!agent) {
      res.status(404).json({ error: "agent_not_found" });
      return;
    }

    const updateData: Record<string, number> = {};
    if (limit_field === "per_tx_limit_cents") updateData.perTxLimitCents = new_limit_cents;
    if (limit_field === "hourly_limit_cents") updateData.hourlyLimitCents = new_limit_cents;
    if (limit_field === "daily_limit_cents") updateData.dailyLimitCents = new_limit_cents;

    await db
      .update(agentIdentitiesTable)
      .set(updateData)
      .where(eq(agentIdentitiesTable.id, agentId));

    const [activePolicy] = await db
      .select()
      .from(spendPoliciesTable)
      .where(and(eq(spendPoliciesTable.agentId, agentId), eq(spendPoliciesTable.isActive, true)))
      .limit(1);

    if (activePolicy) {
      const rules = (activePolicy.rules ?? {}) as Record<string, unknown>;
      rules[limit_field] = new_limit_cents;
      await db
        .update(spendPoliciesTable)
        .set({ rules })
        .where(eq(spendPoliciesTable.id, activePolicy.id));
    }

    const [updated] = await db
      .select()
      .from(agentIdentitiesTable)
      .where(eq(agentIdentitiesTable.id, agentId))
      .limit(1);

    res.json({
      agent_id: updated.id,
      agent_name: updated.name,
      escalated_field: limit_field,
      new_limit_cents,
      limits: {
        per_tx_limit_cents:  updated.perTxLimitCents,
        hourly_limit_cents:  updated.hourlyLimitCents,
        daily_limit_cents:   updated.dailyLimitCents,
      },
    });
  }),
);

export default router;
