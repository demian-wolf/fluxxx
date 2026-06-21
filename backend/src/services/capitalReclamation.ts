import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  agentIdentitiesTable,
  agentWalletsTable,
  gcEventsTable,
  ledgerEntriesTable,
  transactionRequestsTable,
} from "../db/schema";
import type { GcEvent } from "../db/schema";
import { writeLedgerEntry } from "./ledger";

/** Default time-to-live: agents unseen for this many ms are considered zombies. */
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

type GcReason = "ttl_expired" | "agent_revoked" | "agent_suspended" | "parent_terminated";

interface ZombieCandidate {
  id: string;
  walletId: string;
  name: string;
  parentId: string | null;
  status: "active" | "suspended" | "revoked";
  dailyLimitCents: number;
  reason: GcReason;
}

export interface SweepResult {
  zombiesFound: number;
  eventsCreated: GcEvent[];
  totalReclaimedCents: number;
  totalLimitFreed: number;
}

/**
 * Detect agents that qualify as "zombies":
 * 1. Revoked agents that still have daily-limit capacity allocated
 * 2. Suspended agents whose parent is active (stale children)
 * 3. Active agents that have exceeded the TTL since last_seen_at
 */
export async function detectZombieAgents(ttlMs: number = DEFAULT_TTL_MS): Promise<ZombieCandidate[]> {
  const cutoff = new Date(Date.now() - ttlMs);
  const zombies: ZombieCandidate[] = [];

  // 1. Revoked agents with allocated budget capacity
  const revoked = await db
    .select({
      id: agentIdentitiesTable.id,
      walletId: agentIdentitiesTable.walletId,
      name: agentIdentitiesTable.name,
      parentId: agentIdentitiesTable.parentId,
      status: agentIdentitiesTable.status,
      dailyLimitCents: agentIdentitiesTable.dailyLimitCents,
    })
    .from(agentIdentitiesTable)
    .where(eq(agentIdentitiesTable.status, "revoked"));

  for (const agent of revoked) {
    zombies.push({ ...agent, reason: "agent_revoked" });
  }

  // 2. Suspended child agents whose parent is still active
  const suspended = await db
    .select({
      id: agentIdentitiesTable.id,
      walletId: agentIdentitiesTable.walletId,
      name: agentIdentitiesTable.name,
      parentId: agentIdentitiesTable.parentId,
      status: agentIdentitiesTable.status,
      dailyLimitCents: agentIdentitiesTable.dailyLimitCents,
    })
    .from(agentIdentitiesTable)
    .where(
      and(
        eq(agentIdentitiesTable.status, "suspended"),
        sql`${agentIdentitiesTable.parentId} IS NOT NULL`,
      ),
    );

  for (const agent of suspended) {
    zombies.push({ ...agent, reason: "agent_suspended" });
  }

  // 3. TTL-expired: active agents not seen since the cutoff
  const ttlExpired = await db
    .select({
      id: agentIdentitiesTable.id,
      walletId: agentIdentitiesTable.walletId,
      name: agentIdentitiesTable.name,
      parentId: agentIdentitiesTable.parentId,
      status: agentIdentitiesTable.status,
      dailyLimitCents: agentIdentitiesTable.dailyLimitCents,
    })
    .from(agentIdentitiesTable)
    .where(
      and(
        eq(agentIdentitiesTable.status, "active"),
        sql`${agentIdentitiesTable.parentId} IS NOT NULL`,
        or(
          lt(agentIdentitiesTable.lastSeenAt, cutoff),
          isNull(agentIdentitiesTable.lastSeenAt),
        ),
      ),
    );

  for (const agent of ttlExpired) {
    zombies.push({ ...agent, reason: "ttl_expired" });
  }

  // Deduplicate by agent id
  const seen = new Set<string>();
  return zombies.filter((z) => {
    if (seen.has(z.id)) return false;
    seen.add(z.id);
    return true;
  });
}

/**
 * Reclaim capital from a single zombie agent:
 * 1. Revoke the agent (set status → revoked)
 * 2. Invalidate any pending transaction tokens
 * 3. Calculate reclaimable funds and create a refund ledger entry
 * 4. Record a gc_event
 */
async function reclaimFromAgent(zombie: ZombieCandidate): Promise<GcEvent | null> {
  // Skip agents that already had a GC event recorded
  const [existing] = await db
    .select({ id: gcEventsTable.id })
    .from(gcEventsTable)
    .where(eq(gcEventsTable.agentId, zombie.id))
    .limit(1);

  if (existing) return null;

  // Mark agent as revoked if not already
  if (zombie.status !== "revoked") {
    await db
      .update(agentIdentitiesTable)
      .set({ status: "revoked" })
      .where(eq(agentIdentitiesTable.id, zombie.id));
  }

  // Cascade: revoke any active children of this zombie
  const children = await db
    .select({ id: agentIdentitiesTable.id })
    .from(agentIdentitiesTable)
    .where(
      and(
        eq(agentIdentitiesTable.parentId, zombie.id),
        sql`${agentIdentitiesTable.status} != 'revoked'`,
      ),
    );

  if (children.length > 0) {
    await db
      .update(agentIdentitiesTable)
      .set({ status: "revoked" })
      .where(inArray(agentIdentitiesTable.id, children.map((c) => c.id)));
  }

  // Invalidate pending transaction tokens for this agent
  await db
    .update(transactionRequestsTable)
    .set({ decision: "rejected", rejectionReason: "agent_gc_reclaimed" })
    .where(
      and(
        eq(transactionRequestsTable.agentId, zombie.id),
        eq(transactionRequestsTable.decision, "pending"),
      ),
    );

  // Calculate reclaimable funds: the daily-limit capacity this agent consumed
  // from the parent's budget. This capacity is now freed for reallocation.
  const dailyLimitFreed = zombie.dailyLimitCents;

  // If the agent has unspent holds, release them back to the wallet
  const [holdSum] = await db
    .select({
      total: sql<number>`coalesce(sum(${ledgerEntriesTable.amountCents}), 0)`,
    })
    .from(ledgerEntriesTable)
    .where(
      and(
        eq(ledgerEntriesTable.agentId, zombie.id),
        eq(ledgerEntriesTable.type, "hold"),
        eq(ledgerEntriesTable.status, "pending"),
      ),
    );

  const reclaimedCents = Number(holdSum?.total ?? 0);
  let refundEntryId: string | undefined;

  // If there are held funds, release them back to the wallet
  if (reclaimedCents > 0) {
    const [wallet] = await db
      .select({ balanceCents: agentWalletsTable.balanceCents })
      .from(agentWalletsTable)
      .where(eq(agentWalletsTable.id, zombie.walletId))
      .limit(1);

    if (wallet) {
      const entry = await writeLedgerEntry({
        walletId: zombie.walletId,
        walletBalanceCents: wallet.balanceCents,
        agentId: zombie.id,
        type: "refund",
        amountCents: reclaimedCents,
        description: `Capital reclamation: zombie agent "${zombie.name}" (${zombie.reason})`,
        status: "settled",
        metadata: { gc_reason: zombie.reason, reclaimed_from_agent: zombie.id },
      });
      refundEntryId = entry.id;
    }

    // Mark the holds as reversed
    await db
      .update(ledgerEntriesTable)
      .set({ status: "reversed" })
      .where(
        and(
          eq(ledgerEntriesTable.agentId, zombie.id),
          eq(ledgerEntriesTable.type, "hold"),
          eq(ledgerEntriesTable.status, "pending"),
        ),
      );
  }

  // Record the GC event
  const [gcEvent] = await db
    .insert(gcEventsTable)
    .values({
      agentId: zombie.id,
      walletId: zombie.walletId,
      reason: zombie.reason,
      reclaimedCents,
      dailyLimitFreed: dailyLimitFreed,
      refundLedgerEntryId: refundEntryId ?? undefined,
      agentName: zombie.name,
      parentAgentId: zombie.parentId ?? undefined,
    })
    .returning();

  return gcEvent;
}

/**
 * Run a full garbage collection sweep: detect all zombie agents and reclaim
 * their capital. Returns a summary of what was reclaimed.
 */
export async function sweep(ttlMs: number = DEFAULT_TTL_MS): Promise<SweepResult> {
  const zombies = await detectZombieAgents(ttlMs);
  const events: GcEvent[] = [];
  let totalReclaimedCents = 0;
  let totalLimitFreed = 0;

  for (const zombie of zombies) {
    const event = await reclaimFromAgent(zombie);
    if (event) {
      events.push(event);
      totalReclaimedCents += event.reclaimedCents;
      totalLimitFreed += event.dailyLimitFreed;
    }
  }

  return {
    zombiesFound: zombies.length,
    eventsCreated: events,
    totalReclaimedCents,
    totalLimitFreed,
  };
}

/** Fetch all GC events, newest first. */
export async function listGcEvents(): Promise<GcEvent[]> {
  return db
    .select()
    .from(gcEventsTable)
    .orderBy(sql`${gcEventsTable.createdAt} DESC`);
}

/** Aggregate GC statistics. */
export async function getGcStatus(): Promise<{
  totalEvents: number;
  totalReclaimedCents: number;
  totalLimitFreed: number;
  lastSweepAt: string | null;
}> {
  const [stats] = await db
    .select({
      totalEvents: sql<number>`count(*)`,
      totalReclaimedCents: sql<number>`coalesce(sum(${gcEventsTable.reclaimedCents}), 0)`,
      totalLimitFreed: sql<number>`coalesce(sum(${gcEventsTable.dailyLimitFreed}), 0)`,
      lastSweepAt: sql<string | null>`max(${gcEventsTable.createdAt})`,
    })
    .from(gcEventsTable);

  return {
    totalEvents: Number(stats.totalEvents),
    totalReclaimedCents: Number(stats.totalReclaimedCents),
    totalLimitFreed: Number(stats.totalLimitFreed),
    lastSweepAt: stats.lastSweepAt ?? null,
  };
}
