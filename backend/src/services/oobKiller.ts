/**
 * Out-of-Budget (OOB) Killer — the FLUX equivalent of the Linux OOM Killer.
 *
 * When a wallet's balance drops to a critical threshold (default €5), the OOB
 * Killer activates and forcibly invalidates spend tokens of all non-essential
 * child agents to ensure the Root Agent retains enough funds to finalize its task.
 *
 * Trigger: wallet balance <= OOB_THRESHOLD_CENTS after a spend
 * Target:  all non-root child agents on the affected wallet
 * Action:  revoke agents + reject their pending transaction tokens
 * Protect: the root agent(s) (parent_id IS NULL) keep their tokens intact
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import {
  agentIdentitiesTable,
  agentWalletsTable,
  oobKillEventsTable,
  transactionRequestsTable,
} from "../db/schema";
import type { OobKillEvent } from "../db/schema";

/** Default OOB threshold: €5 = 500 cents */
const DEFAULT_OOB_THRESHOLD_CENTS = 500;

export interface OobKillResult {
  triggered: boolean;
  walletId: string;
  balanceCents: number;
  thresholdCents: number;
  agentsKilled: number;
  tokensInvalidated: number;
  protectedAgentId: string | null;
  protectedAgentName: string | null;
  killedAgentNames: string[];
  event: OobKillEvent | null;
}

export interface OobStatus {
  total_events: number;
  total_agents_killed: number;
  total_tokens_invalidated: number;
  last_triggered_at: string | null;
}

/**
 * Check if the OOB Killer should activate for a given wallet. Call this after
 * every approved spend that debits the wallet.
 *
 * Returns a result indicating whether the kill was triggered and what was killed.
 */
export async function checkAndKill(
  walletId: string,
  thresholdCents: number = DEFAULT_OOB_THRESHOLD_CENTS,
): Promise<OobKillResult> {
  // 1. Fetch current wallet balance
  const [wallet] = await db
    .select({ id: agentWalletsTable.id, balanceCents: agentWalletsTable.balanceCents })
    .from(agentWalletsTable)
    .where(eq(agentWalletsTable.id, walletId))
    .limit(1);

  if (!wallet) {
    return {
      triggered: false,
      walletId,
      balanceCents: 0,
      thresholdCents,
      agentsKilled: 0,
      tokensInvalidated: 0,
      protectedAgentId: null,
      protectedAgentName: null,
      killedAgentNames: [],
      event: null,
    };
  }

  // 2. Check if balance is at or below threshold
  if (wallet.balanceCents > thresholdCents) {
    return {
      triggered: false,
      walletId,
      balanceCents: wallet.balanceCents,
      thresholdCents,
      agentsKilled: 0,
      tokensInvalidated: 0,
      protectedAgentId: null,
      protectedAgentName: null,
      killedAgentNames: [],
      event: null,
    };
  }

  // 3. Identify the root agent(s) to protect (parent_id IS NULL, active)
  const rootAgents = await db
    .select({ id: agentIdentitiesTable.id, name: agentIdentitiesTable.name })
    .from(agentIdentitiesTable)
    .where(
      and(
        eq(agentIdentitiesTable.walletId, walletId),
        isNull(agentIdentitiesTable.parentId),
        eq(agentIdentitiesTable.status, "active"),
      ),
    );

  const protectedAgent = rootAgents.length > 0 ? rootAgents[0] : null;

  // 4. Find all non-root child agents on this wallet that are still active
  const childAgents = await db
    .select({ id: agentIdentitiesTable.id, name: agentIdentitiesTable.name })
    .from(agentIdentitiesTable)
    .where(
      and(
        eq(agentIdentitiesTable.walletId, walletId),
        sql`${agentIdentitiesTable.parentId} IS NOT NULL`,
        eq(agentIdentitiesTable.status, "active"),
      ),
    );

  if (childAgents.length === 0) {
    return {
      triggered: false,
      walletId,
      balanceCents: wallet.balanceCents,
      thresholdCents,
      agentsKilled: 0,
      tokensInvalidated: 0,
      protectedAgentId: protectedAgent?.id ?? null,
      protectedAgentName: protectedAgent?.name ?? null,
      killedAgentNames: [],
      event: null,
    };
  }

  const killedIds = childAgents.map((a) => a.id);
  const killedNames = childAgents.map((a) => a.name);

  // 5. Revoke all non-root child agents
  await db
    .update(agentIdentitiesTable)
    .set({ status: "revoked" })
    .where(
      and(
        eq(agentIdentitiesTable.walletId, walletId),
        sql`${agentIdentitiesTable.parentId} IS NOT NULL`,
        eq(agentIdentitiesTable.status, "active"),
      ),
    );

  // 6. Invalidate all pending transaction tokens for killed agents
  const invalidated = await db
    .update(transactionRequestsTable)
    .set({ decision: "rejected", rejectionReason: "oob_killed" })
    .where(
      and(
        eq(transactionRequestsTable.walletId, walletId),
        eq(transactionRequestsTable.decision, "pending"),
        sql`${transactionRequestsTable.agentId} IN (${sql.raw(
          killedIds.map((id) => `'${id}'`).join(","),
        )})`,
      ),
    )
    .returning({ id: transactionRequestsTable.id });

  // 7. Record the OOB kill event
  const [event] = await db
    .insert(oobKillEventsTable)
    .values({
      walletId,
      triggerBalanceCents: wallet.balanceCents,
      thresholdCents,
      agentsKilled: killedIds.length,
      tokensInvalidated: invalidated.length,
      protectedAgentId: protectedAgent?.id ?? undefined,
      protectedAgentName: protectedAgent?.name ?? undefined,
      killedAgentIds: killedIds,
      killedAgentNames: killedNames,
    })
    .returning();

  return {
    triggered: true,
    walletId,
    balanceCents: wallet.balanceCents,
    thresholdCents,
    agentsKilled: killedIds.length,
    tokensInvalidated: invalidated.length,
    protectedAgentId: protectedAgent?.id ?? null,
    protectedAgentName: protectedAgent?.name ?? null,
    killedAgentNames: killedNames,
    event,
  };
}

/** Fetch all OOB kill events, newest first. */
export async function listOobKillEvents(): Promise<OobKillEvent[]> {
  return db
    .select()
    .from(oobKillEventsTable)
    .orderBy(sql`${oobKillEventsTable.createdAt} DESC`);
}

/** Aggregate OOB kill statistics. */
export async function getOobStatus(): Promise<OobStatus> {
  const [stats] = await db
    .select({
      totalEvents: sql<number>`count(*)`,
      totalAgentsKilled: sql<number>`coalesce(sum(${oobKillEventsTable.agentsKilled}), 0)`,
      totalTokensInvalidated: sql<number>`coalesce(sum(${oobKillEventsTable.tokensInvalidated}), 0)`,
      lastTriggeredAt: sql<string | null>`max(${oobKillEventsTable.createdAt})`,
    })
    .from(oobKillEventsTable);

  return {
    total_events: Number(stats.totalEvents),
    total_agents_killed: Number(stats.totalAgentsKilled),
    total_tokens_invalidated: Number(stats.totalTokensInvalidated),
    last_triggered_at: stats.lastTriggeredAt ?? null,
  };
}
