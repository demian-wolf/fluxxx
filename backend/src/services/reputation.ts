/**
 * Agent Reputation / Trust Scoring System.
 *
 * Scores agents 0–100 based on:
 *   - Approval rate (rejections lower trust)
 *   - Policy compliance history
 *   - Activity consistency (idle periods lower trust)
 *   - OOB/GC events (being killed tanks score)
 */
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";
import {
  agentIdentitiesTable,
  transactionRequestsTable,
  oobKillEventsTable,
  gcEventsTable,
} from "../db/schema";

export interface ReputationScore {
  agentId: string;
  agentName: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  breakdown: ReputationBreakdown;
  trend: "improving" | "stable" | "declining";
  lastUpdated: string;
}

export interface ReputationBreakdown {
  approvalRate: number;
  approvalRateScore: number;
  complianceScore: number;
  activityScore: number;
  incidentScore: number;
  totalTransactions: number;
  rejectedTransactions: number;
  oobKills: number;
  gcReclamations: number;
}

const WEIGHTS = {
  approvalRate: 0.35,
  compliance: 0.25,
  activity: 0.20,
  incidents: 0.20,
};

function gradeFromScore(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

/**
 * Calculate reputation score for a single agent.
 */
export async function calculateReputation(agentId: string): Promise<ReputationScore> {
  const [agent] = await db
    .select({ id: agentIdentitiesTable.id, name: agentIdentitiesTable.name, lastSeenAt: agentIdentitiesTable.lastSeenAt })
    .from(agentIdentitiesTable)
    .where(eq(agentIdentitiesTable.id, agentId))
    .limit(1);

  if (!agent) throw new Error("agent_not_found");

  const windowCutoff = new Date(Date.now() - 7 * 24 * 3_600_000);

  // Transaction stats
  const [txStats] = await db
    .select({
      total: sql<number>`count(*)`,
      rejected: sql<number>`count(*) filter (where ${transactionRequestsTable.decision} = 'rejected')`,
    })
    .from(transactionRequestsTable)
    .where(
      and(
        eq(transactionRequestsTable.agentId, agentId),
        gte(transactionRequestsTable.createdAt, windowCutoff),
      ),
    );

  const totalTx = Number(txStats.total);
  const rejectedTx = Number(txStats.rejected);
  const approvalRate = totalTx > 0 ? ((totalTx - rejectedTx) / totalTx) * 100 : 100;
  const approvalRateScore = Math.min(100, approvalRate * 1.1);

  // OOB kill involvement
  const [oobStats] = await db
    .select({ count: sql<number>`count(*)` })
    .from(oobKillEventsTable)
    .where(
      and(
        sql`${agentId} = ANY(${oobKillEventsTable.killedAgentIds})`,
        gte(oobKillEventsTable.createdAt, windowCutoff),
      ),
    );
  const oobKills = Number(oobStats.count);

  // GC reclamation involvement
  const [gcStats] = await db
    .select({ count: sql<number>`count(*)` })
    .from(gcEventsTable)
    .where(
      and(
        eq(gcEventsTable.agentId, agentId),
        gte(gcEventsTable.createdAt, windowCutoff),
      ),
    );
  const gcReclamations = Number(gcStats.count);

  // Compliance score: penalize for specific rejection reasons
  const complianceScore = Math.max(0, 100 - (rejectedTx * 5));

  // Activity score: based on last_seen recency
  let activityScore = 100;
  if (agent.lastSeenAt) {
    const hoursSinceActive = (Date.now() - agent.lastSeenAt.getTime()) / 3_600_000;
    if (hoursSinceActive > 48) activityScore = 30;
    else if (hoursSinceActive > 24) activityScore = 60;
    else if (hoursSinceActive > 6) activityScore = 80;
  } else {
    activityScore = 50;
  }

  // Incident score: penalize for OOB kills and GC reclamations
  const incidentPenalty = (oobKills * 25) + (gcReclamations * 15);
  const incidentScore = Math.max(0, 100 - incidentPenalty);

  // Weighted final score
  const score = Math.round(
    approvalRateScore * WEIGHTS.approvalRate +
    complianceScore * WEIGHTS.compliance +
    activityScore * WEIGHTS.activity +
    incidentScore * WEIGHTS.incidents,
  );

  // Determine trend (simplified: compare recent vs. older approval rate)
  const recentCutoff = new Date(Date.now() - 24 * 3_600_000);
  const [recentStats] = await db
    .select({
      total: sql<number>`count(*)`,
      rejected: sql<number>`count(*) filter (where ${transactionRequestsTable.decision} = 'rejected')`,
    })
    .from(transactionRequestsTable)
    .where(
      and(
        eq(transactionRequestsTable.agentId, agentId),
        gte(transactionRequestsTable.createdAt, recentCutoff),
      ),
    );

  const recentTotal = Number(recentStats.total);
  const recentRejected = Number(recentStats.rejected);
  const recentApprovalRate = recentTotal > 0 ? ((recentTotal - recentRejected) / recentTotal) * 100 : 100;

  let trend: "improving" | "stable" | "declining" = "stable";
  if (recentApprovalRate > approvalRate + 5) trend = "improving";
  else if (recentApprovalRate < approvalRate - 5) trend = "declining";

  return {
    agentId,
    agentName: agent.name,
    score,
    grade: gradeFromScore(score),
    breakdown: {
      approvalRate,
      approvalRateScore,
      complianceScore,
      activityScore,
      incidentScore,
      totalTransactions: totalTx,
      rejectedTransactions: rejectedTx,
      oobKills,
      gcReclamations,
    },
    trend,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Calculate reputation for all agents in the system.
 */
export async function calculateAllReputations(): Promise<ReputationScore[]> {
  const agents = await db
    .select({ id: agentIdentitiesTable.id })
    .from(agentIdentitiesTable);

  const results: ReputationScore[] = [];
  for (const agent of agents) {
    try {
      const rep = await calculateReputation(agent.id);
      results.push(rep);
    } catch {
      // skip agents that error
    }
  }
  return results.sort((a, b) => b.score - a.score);
}
