/**
 * Budget Forecasting Service — predicts wallet depletion time based on
 * rolling spend velocity. Gives operators "time until empty" visibility.
 */
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { agentWalletsTable, ledgerEntriesTable, agentIdentitiesTable } from "../db/schema";

export interface BurnRate {
  centsPerHour: number;
  centsPerDay: number;
  windowHours: number;
}

export interface DepletionForecast {
  walletId: string;
  balanceCents: number;
  burnRate: BurnRate;
  depletesAt: string | null;
  hoursRemaining: number | null;
  oobThresholdCents: number;
  hitsOobAt: string | null;
  hoursUntilOob: number | null;
  confidence: "high" | "medium" | "low";
  agentBurnRates: AgentBurnRate[];
}

export interface AgentBurnRate {
  agentId: string;
  agentName: string;
  centsPerHour: number;
  percentOfTotal: number;
}

const DEFAULT_WINDOW_HOURS = 24;
const OOB_THRESHOLD_CENTS = 500;

/**
 * Calculate the burn rate for a wallet over a rolling window.
 */
async function calculateBurnRate(
  walletId: string,
  windowHours: number = DEFAULT_WINDOW_HOURS,
): Promise<BurnRate> {
  const cutoff = new Date(Date.now() - windowHours * 3_600_000);

  const [result] = await db
    .select({
      totalSpent: sql<number>`coalesce(sum(${ledgerEntriesTable.amountCents}), 0)`,
    })
    .from(ledgerEntriesTable)
    .where(
      and(
        eq(ledgerEntriesTable.walletId, walletId),
        eq(ledgerEntriesTable.type, "spend"),
        eq(ledgerEntriesTable.status, "settled"),
        gte(ledgerEntriesTable.createdAt, cutoff),
      ),
    );

  const totalSpent = Number(result.totalSpent);
  const centsPerHour = windowHours > 0 ? totalSpent / windowHours : 0;
  const centsPerDay = centsPerHour * 24;

  return { centsPerHour, centsPerDay, windowHours };
}

/**
 * Calculate per-agent burn rates for a wallet.
 */
async function calculateAgentBurnRates(
  walletId: string,
  windowHours: number = DEFAULT_WINDOW_HOURS,
): Promise<AgentBurnRate[]> {
  const cutoff = new Date(Date.now() - windowHours * 3_600_000);

  const results = await db
    .select({
      agentId: ledgerEntriesTable.agentId,
      agentName: agentIdentitiesTable.name,
      totalSpent: sql<number>`coalesce(sum(${ledgerEntriesTable.amountCents}), 0)`,
    })
    .from(ledgerEntriesTable)
    .innerJoin(
      agentIdentitiesTable,
      eq(ledgerEntriesTable.agentId, agentIdentitiesTable.id),
    )
    .where(
      and(
        eq(ledgerEntriesTable.walletId, walletId),
        eq(ledgerEntriesTable.type, "spend"),
        eq(ledgerEntriesTable.status, "settled"),
        gte(ledgerEntriesTable.createdAt, cutoff),
      ),
    )
    .groupBy(ledgerEntriesTable.agentId, agentIdentitiesTable.name);

  const totalSpent = results.reduce((sum, r) => sum + Number(r.totalSpent), 0);

  return results
    .filter((r) => r.agentId !== null)
    .map((r) => ({
      agentId: r.agentId!,
      agentName: r.agentName,
      centsPerHour: windowHours > 0 ? Number(r.totalSpent) / windowHours : 0,
      percentOfTotal: totalSpent > 0 ? (Number(r.totalSpent) / totalSpent) * 100 : 0,
    }))
    .sort((a, b) => b.centsPerHour - a.centsPerHour);
}

/**
 * Determine forecast confidence based on data availability.
 */
function determineConfidence(
  burnRate: BurnRate,
  windowHours: number,
): "high" | "medium" | "low" {
  const totalDataPoints = burnRate.centsPerHour * windowHours;
  if (totalDataPoints === 0) return "low";
  if (windowHours >= 24 && totalDataPoints > 100) return "high";
  if (windowHours >= 6 && totalDataPoints > 20) return "medium";
  return "low";
}

/**
 * Generate a full depletion forecast for a wallet.
 */
export async function forecastDepletion(
  walletId: string,
  windowHours: number = DEFAULT_WINDOW_HOURS,
): Promise<DepletionForecast> {
  const [wallet] = await db
    .select()
    .from(agentWalletsTable)
    .where(eq(agentWalletsTable.id, walletId))
    .limit(1);

  if (!wallet) {
    throw new Error("wallet_not_found");
  }

  const burnRate = await calculateBurnRate(walletId, windowHours);
  const agentBurnRates = await calculateAgentBurnRates(walletId, windowHours);
  const confidence = determineConfidence(burnRate, windowHours);

  let depletesAt: string | null = null;
  let hoursRemaining: number | null = null;
  let hitsOobAt: string | null = null;
  let hoursUntilOob: number | null = null;

  if (burnRate.centsPerHour > 0) {
    hoursRemaining = wallet.balanceCents / burnRate.centsPerHour;
    depletesAt = new Date(Date.now() + hoursRemaining * 3_600_000).toISOString();

    const centsUntilOob = wallet.balanceCents - OOB_THRESHOLD_CENTS;
    if (centsUntilOob > 0) {
      hoursUntilOob = centsUntilOob / burnRate.centsPerHour;
      hitsOobAt = new Date(Date.now() + hoursUntilOob * 3_600_000).toISOString();
    } else {
      hoursUntilOob = 0;
      hitsOobAt = new Date().toISOString();
    }
  }

  return {
    walletId,
    balanceCents: wallet.balanceCents,
    burnRate,
    depletesAt,
    hoursRemaining,
    oobThresholdCents: OOB_THRESHOLD_CENTS,
    hitsOobAt,
    hoursUntilOob,
    confidence,
    agentBurnRates,
  };
}
