import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { agentIdentitiesTable } from "./agent_identities";
import { agentWalletsTable } from "./agent_wallets";

export const oobKillEventsTable = pgTable("oob_kill_events", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  walletId:            uuid("wallet_id").notNull().references(() => agentWalletsTable.id),
  triggerBalanceCents: integer("trigger_balance_cents").notNull(),
  thresholdCents:      integer("threshold_cents").notNull(),
  agentsKilled:        integer("agents_killed").notNull().default(0),
  tokensInvalidated:   integer("tokens_invalidated").notNull().default(0),
  protectedAgentId:    uuid("protected_agent_id").references(() => agentIdentitiesTable.id),
  protectedAgentName:  text("protected_agent_name"),
  killedAgentIds:      text("killed_agent_ids").array(),
  killedAgentNames:    text("killed_agent_names").array(),
  createdAt:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOobKillEventSchema = createInsertSchema(oobKillEventsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertOobKillEvent = typeof oobKillEventsTable.$inferInsert;
export type OobKillEvent = typeof oobKillEventsTable.$inferSelect;
