import { Router } from "express";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { agentIdentitiesTable, agentWalletsTable, ledgerEntriesTable, spendPoliciesTable } from "../db/schema";
import { generateAgentApiKey, hashApiKey } from "../services/auth";
import { spentInWindow } from "../services/ledger";
import { agentAuth } from "../middleware/agentAuth";
import { userAuth } from "../middleware/userAuth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

/**
 * POST /api/agents/register
 * Operator creates a new agent identity and receives the API key (shown once).
 * (backend-architecture.md section 2.6)
 */
router.post(
  "/register",
  userAuth,
  asyncHandler(async (req, res) => {
    const {
      wallet_id,
      parent_id,
      name,
      hourly_limit_cents,
      per_tx_limit_cents,
      daily_limit_cents,
      allowed_domains,
    } = req.body ?? {};

    if (typeof wallet_id !== "string" || typeof name !== "string") {
      res.status(400).json({ error: "missing_required_fields" });
      return;
    }

    const [wallet] = await db
      .select({ id: agentWalletsTable.id, ownerId: agentWalletsTable.ownerId })
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

    // A child agent attaches under a parent in the spend tree. The parent must
    // belong to the same operator and live in the same wallet.
    if (parent_id != null) {
      if (typeof parent_id !== "string") {
        res.status(400).json({ error: "invalid_parent" });
        return;
      }
      const [parent] = await db
        .select({
          id:       agentIdentitiesTable.id,
          ownerId:  agentIdentitiesTable.ownerId,
          walletId: agentIdentitiesTable.walletId,
        })
        .from(agentIdentitiesTable)
        .where(eq(agentIdentitiesTable.id, parent_id))
        .limit(1);

      if (!parent || parent.ownerId !== req.userId) {
        res.status(404).json({ error: "parent_not_found" });
        return;
      }
      if (parent.walletId !== wallet_id) {
        res.status(400).json({ error: "parent_wallet_mismatch" });
        return;
      }
    }

    const rawKey    = generateAgentApiKey();
    const apiKeyHash = hashApiKey(rawKey);

    const [agent] = await db
      .insert(agentIdentitiesTable)
      .values({
        walletId:         wallet_id,
        parentId:         typeof parent_id === "string" ? parent_id : null,
        ownerId:          req.userId as string,
        name,
        apiKeyHash,
        hourlyLimitCents: Number(hourly_limit_cents ?? 200),
        perTxLimitCents:  Number(per_tx_limit_cents ?? 10),
        dailyLimitCents:  Number(daily_limit_cents ?? 1000),
        allowedDomains:   Array.isArray(allowed_domains) ? allowed_domains : undefined,
      })
      .returning({ id: agentIdentitiesTable.id });

    res.status(201).json({
      agent_id: agent.id,
      api_key:  rawKey,
      warning:  "Store this key securely. It will not be shown again.",
    });
  }),
);

/**
 * GET /api/agents
 * List all agents for the authenticated operator.
 */
router.get(
  "/",
  userAuth,
  asyncHandler(async (req, res) => {
    const agents = await db
      .select()
      .from(agentIdentitiesTable)
      .where(eq(agentIdentitiesTable.ownerId, req.userId as string));

    res.json(agents);
  }),
);

/**
 * GET /api/agents/:id
 * Get a single agent by ID.
 */
router.get(
  "/:id",
  userAuth,
  asyncHandler(async (req, res) => {
    const [agent] = await db
      .select()
      .from(agentIdentitiesTable)
      .where(and(eq(agentIdentitiesTable.id, req.params.id), eq(agentIdentitiesTable.ownerId, req.userId as string)))
      .limit(1);

    if (!agent) {
      res.status(404).json({ error: "agent_not_found" });
      return;
    }
    res.json(agent);
  }),
);

/**
 * PATCH /api/agents/:id
 * Update agent status (active | suspended | revoked).
 */
router.patch(
  "/:id",
  userAuth,
  asyncHandler(async (req, res) => {
    const { status } = req.body ?? {};
    const allowed = ["active", "suspended", "revoked"];
    if (typeof status !== "string" || !allowed.includes(status)) {
      res.status(400).json({ error: "invalid_status" });
      return;
    }

    const [agent] = await db
      .select({ id: agentIdentitiesTable.id, ownerId: agentIdentitiesTable.ownerId })
      .from(agentIdentitiesTable)
      .where(and(eq(agentIdentitiesTable.id, req.params.id), eq(agentIdentitiesTable.ownerId, req.userId as string)))
      .limit(1);

    if (!agent) {
      res.status(404).json({ error: "agent_not_found" });
      return;
    }

    // Process-tree teardown: suspending or revoking a parent cascades to its
    // entire subtree, mirroring how killing a parent process kills its children.
    // Reactivating is intentionally not cascaded — children must be restarted
    // explicitly.
    const targetIds = [agent.id];
    if (status === "suspended" || status === "revoked") {
      const owned = await db
        .select({ id: agentIdentitiesTable.id, parentId: agentIdentitiesTable.parentId })
        .from(agentIdentitiesTable)
        .where(eq(agentIdentitiesTable.ownerId, req.userId as string));

      const childrenByParent = new Map<string, string[]>();
      for (const row of owned) {
        if (!row.parentId) continue;
        const siblings = childrenByParent.get(row.parentId) ?? [];
        siblings.push(row.id);
        childrenByParent.set(row.parentId, siblings);
      }

      const queue = [agent.id];
      const seen = new Set(queue);
      while (queue.length) {
        const current = queue.shift() as string;
        for (const child of childrenByParent.get(current) ?? []) {
          if (seen.has(child)) continue;
          seen.add(child);
          targetIds.push(child);
          queue.push(child);
        }
      }
    }

    await db
      .update(agentIdentitiesTable)
      .set({ status: status as "active" | "suspended" | "revoked" })
      .where(inArray(agentIdentitiesTable.id, targetIds));

    const [updated] = await db
      .select()
      .from(agentIdentitiesTable)
      .where(eq(agentIdentitiesTable.id, agent.id))
      .limit(1);

    res.json({ ...updated, affected_agent_ids: targetIds });
  }),
);

/**
 * GET /api/agents/:id/analytics
 * Rolling spend windows for an agent.
 */
router.get(
  "/:id/analytics",
  userAuth,
  asyncHandler(async (req, res) => {
    const agentId = req.params.id;
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const ONE_DAY_MS  = 24 * ONE_HOUR_MS;

    const [agent] = await db
      .select({ id: agentIdentitiesTable.id, walletId: agentIdentitiesTable.walletId })
      .from(agentIdentitiesTable)
      .where(and(eq(agentIdentitiesTable.id, agentId), eq(agentIdentitiesTable.ownerId, req.userId as string)))
      .limit(1);

    if (!agent) {
      res.status(404).json({ error: "agent_not_found" });
      return;
    }

    const [hourly, daily] = await Promise.all([
      spentInWindow(agent.walletId, agentId, ONE_HOUR_MS),
      spentInWindow(agent.walletId, agentId, ONE_DAY_MS),
    ]);

    res.json({ spent_last_hour_cents: hourly, spent_today_cents: daily });
  }),
);

/**
 * GET /api/agents/:id/spend-series
 * Daily spend totals for an agent (last 30 days).
 */
router.get(
  "/:id/spend-series",
  userAuth,
  asyncHandler(async (req, res) => {
    const agentId = req.params.id;

    const [agent] = await db
      .select({ id: agentIdentitiesTable.id })
      .from(agentIdentitiesTable)
      .where(and(eq(agentIdentitiesTable.id, agentId), eq(agentIdentitiesTable.ownerId, req.userId as string)))
      .limit(1);

    if (!agent) {
      res.status(404).json({ error: "agent_not_found" });
      return;
    }

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        date:  sql<string>`date_trunc('day', ${ledgerEntriesTable.createdAt})::date`,
        total: sql<number>`coalesce(sum(${ledgerEntriesTable.amountCents}), 0)`,
      })
      .from(ledgerEntriesTable)
      .where(
        and(
          eq(ledgerEntriesTable.agentId, agentId),
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
 * GET /api/agents/:id/policies
 * All policy versions for an agent (audit history).
 */
router.get(
  "/:id/policies",
  userAuth,
  asyncHandler(async (req, res) => {
    const [agent] = await db
      .select({ id: agentIdentitiesTable.id })
      .from(agentIdentitiesTable)
      .where(and(eq(agentIdentitiesTable.id, req.params.id), eq(agentIdentitiesTable.ownerId, req.userId as string)))
      .limit(1);

    if (!agent) {
      res.status(404).json({ error: "agent_not_found" });
      return;
    }

    const policies = await db
      .select()
      .from(spendPoliciesTable)
      .where(eq(spendPoliciesTable.agentId, agent.id))
      .orderBy(desc(spendPoliciesTable.version));

    res.json(policies);
  }),
);

/**
 * GET /api/agents/:id/policies/active
 * Get the currently active policy for an agent.
 */
router.get(
  "/:id/policies/active",
  userAuth,
  asyncHandler(async (req, res) => {
    const [agent] = await db
      .select({ id: agentIdentitiesTable.id })
      .from(agentIdentitiesTable)
      .where(and(eq(agentIdentitiesTable.id, req.params.id), eq(agentIdentitiesTable.ownerId, req.userId as string)))
      .limit(1);

    if (!agent) {
      res.status(404).json({ error: "agent_not_found" });
      return;
    }

    const [policy] = await db
      .select()
      .from(spendPoliciesTable)
      .where(and(eq(spendPoliciesTable.agentId, agent.id), eq(spendPoliciesTable.isActive, true)))
      .limit(1);

    res.json(policy ?? null);
  }),
);

/**
 * POST /api/agents/:id/policy
 * Create a new policy version (deactivates the previous one).
 */
router.post(
  "/:id/policy",
  userAuth,
  asyncHandler(async (req, res) => {
    const { rules } = req.body ?? {};
    if (typeof rules !== "object" || rules === null) {
      res.status(400).json({ error: "missing_rules" });
      return;
    }

    const [agent] = await db
      .select({ id: agentIdentitiesTable.id })
      .from(agentIdentitiesTable)
      .where(and(eq(agentIdentitiesTable.id, req.params.id), eq(agentIdentitiesTable.ownerId, req.userId as string)))
      .limit(1);

    if (!agent) {
      res.status(404).json({ error: "agent_not_found" });
      return;
    }

    const [current] = await db
      .select({ version: spendPoliciesTable.version })
      .from(spendPoliciesTable)
      .where(and(eq(spendPoliciesTable.agentId, agent.id), eq(spendPoliciesTable.isActive, true)))
      .limit(1);

    await db
      .update(spendPoliciesTable)
      .set({ isActive: false })
      .where(and(eq(spendPoliciesTable.agentId, agent.id), eq(spendPoliciesTable.isActive, true)));

    const [policy] = await db
      .insert(spendPoliciesTable)
      .values({
        agentId:   agent.id,
        version:   (current?.version ?? 0) + 1,
        rules,
        isActive:  true,
        createdBy: req.userId as string,
      })
      .returning();

    res.status(201).json(policy);
  }),
);

/**
 * POST /api/agents/spawn
 * An authenticated agent creates a child sub-agent. The calling agent becomes
 * the parent. Budget validation ensures the child's limits don't exceed the
 * parent's remaining capacity (daily_limit - sum of existing children's
 * daily_limits). Domain access is inherited: if the parent has an allowlist the
 * child's allowed_domains must be a subset.
 *
 * OS analog: fork() — a running process spawns a child that inherits a subset
 * of the parent's resources.
 */
router.post(
  "/spawn",
  agentAuth,
  asyncHandler(async (req, res) => {
    const session = req.agent!;
    const {
      name,
      hourly_limit_cents,
      per_tx_limit_cents,
      daily_limit_cents,
      allowed_domains,
    } = req.body ?? {};

    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "missing_name" });
      return;
    }
    if (typeof daily_limit_cents !== "number" || daily_limit_cents <= 0) {
      res.status(400).json({ error: "invalid_daily_limit" });
      return;
    }

    const [parent] = await db
      .select()
      .from(agentIdentitiesTable)
      .where(eq(agentIdentitiesTable.id, session.sub))
      .limit(1);

    if (!parent) {
      res.status(404).json({ error: "parent_not_found" });
      return;
    }
    if (parent.status !== "active") {
      res.status(403).json({ error: "parent_not_active" });
      return;
    }

    // Check the parent's active policy for a can_spawn flag.
    const [parentPolicy] = await db
      .select()
      .from(spendPoliciesTable)
      .where(and(eq(spendPoliciesTable.agentId, parent.id), eq(spendPoliciesTable.isActive, true)))
      .limit(1);

    const policyRules = parentPolicy?.rules as Record<string, unknown> | undefined;
    if (policyRules?.can_spawn === false) {
      res.status(403).json({ error: "spawn_not_permitted" });
      return;
    }

    // Budget validation: child limits cannot exceed parent limits.
    const effectiveHourly = Number(hourly_limit_cents ?? parent.hourlyLimitCents);
    const effectivePerTx  = Number(per_tx_limit_cents ?? parent.perTxLimitCents);
    const effectiveDaily  = Number(daily_limit_cents);

    if (effectiveHourly > parent.hourlyLimitCents) {
      res.status(400).json({ error: "hourly_limit_exceeds_parent", parent_hourly: parent.hourlyLimitCents });
      return;
    }
    if (effectivePerTx > parent.perTxLimitCents) {
      res.status(400).json({ error: "per_tx_limit_exceeds_parent", parent_per_tx: parent.perTxLimitCents });
      return;
    }

    // Check remaining daily capacity: parent.dailyLimit - sum(children.dailyLimits)
    const [siblingSum] = await db
      .select({ total: sql<number>`coalesce(sum(${agentIdentitiesTable.dailyLimitCents}), 0)` })
      .from(agentIdentitiesTable)
      .where(eq(agentIdentitiesTable.parentId, parent.id));

    const allocated = Number(siblingSum?.total ?? 0);
    const remaining = parent.dailyLimitCents - allocated;
    if (effectiveDaily > remaining) {
      res.status(400).json({
        error: "daily_limit_exceeds_remaining",
        parent_daily: parent.dailyLimitCents,
        already_allocated: allocated,
        remaining,
        requested: effectiveDaily,
      });
      return;
    }

    // Domain inheritance: child's allowed_domains must be a subset of parent's.
    const parentDomains = parent.allowedDomains ?? [];
    const childDomains: string[] = Array.isArray(allowed_domains) ? allowed_domains : [];
    if (parentDomains.length > 0 && childDomains.length > 0) {
      const invalid = childDomains.filter((d: string) => !parentDomains.includes(d));
      if (invalid.length > 0) {
        res.status(400).json({ error: "domains_not_subset_of_parent", invalid_domains: invalid });
        return;
      }
    }
    // If parent has an allowlist but child specifies none, child inherits parent's list.
    const finalDomains = parentDomains.length > 0 && childDomains.length === 0
      ? parentDomains
      : childDomains.length > 0 ? childDomains : undefined;

    const rawKey     = generateAgentApiKey();
    const apiKeyHash = hashApiKey(rawKey);

    const [child] = await db
      .insert(agentIdentitiesTable)
      .values({
        walletId:         parent.walletId,
        parentId:         parent.id,
        ownerId:          parent.ownerId,
        name:             name.trim(),
        apiKeyHash,
        hourlyLimitCents: effectiveHourly,
        perTxLimitCents:  effectivePerTx,
        dailyLimitCents:  effectiveDaily,
        allowedDomains:   finalDomains,
      })
      .returning({ id: agentIdentitiesTable.id });

    res.status(201).json({
      agent_id:   child.id,
      parent_id:  parent.id,
      api_key:    rawKey,
      wallet_id:  parent.walletId,
      limits: {
        hourly_limit_cents: effectiveHourly,
        per_tx_limit_cents: effectivePerTx,
        daily_limit_cents:  effectiveDaily,
      },
      allowed_domains: finalDomains ?? [],
      warning: "Store this key securely. It will not be shown again.",
    });
  }),
);

export default router;
