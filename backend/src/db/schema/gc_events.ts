import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { agentIdentitiesTable } from "./agent_identities";
import { agentWalletsTable } from "./agent_wallets";
import { ledgerEntriesTable } from "./ledger_entries";

export const gcReasonEnum = pgEnum("gc_reason", [
  "ttl_expired",
  "agent_revoked",
  "agent_suspended",
  "parent_terminated",
]);

export const gcEventsTable = pgTable("gc_events", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  agentId:            uuid("agent_id").notNull().references(() => agentIdentitiesTable.id),
  walletId:           uuid("wallet_id").notNull().references(() => agentWalletsTable.id),
  reason:             gcReasonEnum("reason").notNull(),
  reclaimedCents:     integer("reclaimed_cents").notNull().default(0),
  dailyLimitFreed:    integer("daily_limit_freed").notNull().default(0),
  refundLedgerEntryId: uuid("refund_ledger_entry_id").references(() => ledgerEntriesTable.id),
  agentName:          text("agent_name").notNull(),
  parentAgentId:      uuid("parent_agent_id"),
  createdAt:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGcEventSchema = createInsertSchema(gcEventsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertGcEvent = typeof gcEventsTable.$inferInsert;
export type GcEvent = typeof gcEventsTable.$inferSelect;
