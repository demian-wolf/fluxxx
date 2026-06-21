/**
 * Custom Policy Plugin Architecture.
 *
 * Allows operators to register custom rule evaluators that run as part of
 * the policy engine chain. Plugins are pure functions:
 *   (context) => { allowed: boolean, reason?: string }
 *
 * Built-in plugins:
 *   - time_restriction: block spend outside business hours
 *   - geo_fence: block based on payee domain geography
 *   - anomaly_detector: flag unusual spend patterns
 *   - category_budget: per-category daily limits
 */

export interface PluginContext {
  agentId: string;
  agentName: string;
  walletId: string;
  amountCents: number;
  payeeUrl: string;
  description: string;
  category: string | null;
  hourlySpentCents: number;
  dailySpentCents: number;
  balanceCents: number;
  recentTransactions: Array<{
    amountCents: number;
    payeeUrl: string;
    createdAt: string;
  }>;
}

export interface PluginResult {
  allowed: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export type PolicyPlugin = (context: PluginContext) => PluginResult | Promise<PluginResult>;

export interface PluginRegistration {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  config: Record<string, unknown>;
  evaluate: PolicyPlugin;
}

// Plugin registry
const plugins: Map<string, PluginRegistration> = new Map();

/**
 * Register a custom policy plugin.
 */
export function registerPlugin(registration: PluginRegistration): void {
  plugins.set(registration.id, registration);
}

/**
 * Remove a plugin by ID.
 */
export function removePlugin(pluginId: string): boolean {
  return plugins.delete(pluginId);
}

/**
 * List all registered plugins.
 */
export function listPlugins(): PluginRegistration[] {
  return Array.from(plugins.values()).sort((a, b) => a.priority - b.priority);
}

/**
 * Run all enabled plugins against a transaction context.
 * Returns on first rejection or passes if all allow.
 */
export async function evaluatePlugins(context: PluginContext): Promise<PluginResult> {
  const sorted = Array.from(plugins.values())
    .filter((p) => p.enabled)
    .sort((a, b) => a.priority - b.priority);

  for (const plugin of sorted) {
    const result = await plugin.evaluate(context);
    if (!result.allowed) {
      return {
        allowed: false,
        reason: `plugin:${plugin.id}:${result.reason ?? "blocked"}`,
        metadata: { plugin_id: plugin.id, plugin_name: plugin.name, ...result.metadata },
      };
    }
  }

  return { allowed: true };
}

// ---- Built-in Plugins ----

/**
 * Time Restriction Plugin: block spend outside configured hours.
 */
const timeRestrictionPlugin: PolicyPlugin = (_context) => {
  const config = plugins.get("time_restriction")?.config as
    | { startHour?: number; endHour?: number; timezone?: string }
    | undefined;

  const startHour = config?.startHour ?? 8;
  const endHour = config?.endHour ?? 22;
  const now = new Date();
  const hour = now.getUTCHours();

  if (hour < startHour || hour >= endHour) {
    return {
      allowed: false,
      reason: "outside_business_hours",
      metadata: { current_hour: hour, allowed_range: `${startHour}-${endHour} UTC` },
    };
  }
  return { allowed: true };
};

/**
 * Anomaly Detector Plugin: flag spend amounts significantly above recent average.
 */
const anomalyDetectorPlugin: PolicyPlugin = (context) => {
  if (context.recentTransactions.length < 5) {
    return { allowed: true };
  }

  const amounts = context.recentTransactions.map((t) => t.amountCents);
  const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
  const stdDev = Math.sqrt(
    amounts.reduce((s, a) => s + (a - avg) ** 2, 0) / amounts.length,
  );

  const zScore = stdDev > 0 ? (context.amountCents - avg) / stdDev : 0;

  if (zScore > 3) {
    return {
      allowed: false,
      reason: "anomaly_detected",
      metadata: {
        z_score: Math.round(zScore * 100) / 100,
        average_cents: Math.round(avg),
        std_dev_cents: Math.round(stdDev),
        requested_cents: context.amountCents,
      },
    };
  }
  return { allowed: true };
};

/**
 * Category Budget Plugin: enforce per-category daily limits.
 */
const categoryBudgetPlugin: PolicyPlugin = (context) => {
  const budgetConfig = plugins.get("category_budget")?.config as
    | { limits?: Record<string, number> }
    | undefined;

  if (!context.category || !budgetConfig?.limits) {
    return { allowed: true };
  }

  const categoryLimit = budgetConfig.limits[context.category];
  if (categoryLimit === undefined) {
    return { allowed: true };
  }

  const categorySpent = context.recentTransactions
    .filter((t) => t.payeeUrl.includes(context.category!))
    .reduce((s, t) => s + t.amountCents, 0);

  if (categorySpent + context.amountCents > categoryLimit) {
    return {
      allowed: false,
      reason: "category_budget_exceeded",
      metadata: {
        category: context.category,
        category_spent_cents: categorySpent,
        category_limit_cents: categoryLimit,
      },
    };
  }
  return { allowed: true };
};

/**
 * Velocity Plugin: reject if more than N transactions in last M minutes.
 */
const velocityPlugin: PolicyPlugin = (context) => {
  const velocityConfig = plugins.get("velocity_limit")?.config as
    | { maxTxPerWindow?: number; windowMinutes?: number }
    | undefined;

  const maxTx = velocityConfig?.maxTxPerWindow ?? 50;
  const windowMs = (velocityConfig?.windowMinutes ?? 5) * 60_000;
  const cutoff = Date.now() - windowMs;

  const recentCount = context.recentTransactions.filter(
    (t) => new Date(t.createdAt).getTime() >= cutoff,
  ).length;

  if (recentCount >= maxTx) {
    return {
      allowed: false,
      reason: "velocity_exceeded",
      metadata: {
        transactions_in_window: recentCount,
        max_allowed: maxTx,
        window_minutes: velocityConfig?.windowMinutes ?? 5,
      },
    };
  }
  return { allowed: true };
};

// Register built-in plugins (disabled by default)
registerPlugin({
  id: "time_restriction",
  name: "Business Hours Restriction",
  description: "Block agent spend outside configured business hours (UTC)",
  enabled: false,
  priority: 10,
  config: { startHour: 8, endHour: 22 },
  evaluate: timeRestrictionPlugin,
});

registerPlugin({
  id: "anomaly_detector",
  name: "Spend Anomaly Detector",
  description: "Flag transactions with z-score > 3 compared to recent average",
  enabled: false,
  priority: 20,
  config: {},
  evaluate: anomalyDetectorPlugin,
});

registerPlugin({
  id: "category_budget",
  name: "Category Budget Limits",
  description: "Enforce per-category daily spend limits",
  enabled: false,
  priority: 30,
  config: { limits: { data: 500, compute: 1000, api_access: 300 } },
  evaluate: categoryBudgetPlugin,
});

registerPlugin({
  id: "velocity_limit",
  name: "Transaction Velocity Limit",
  description: "Block agent if transaction count exceeds threshold in time window",
  enabled: false,
  priority: 40,
  config: { maxTxPerWindow: 50, windowMinutes: 5 },
  evaluate: velocityPlugin,
});
