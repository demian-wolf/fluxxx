import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";
import { agentWalletsTable } from "./agent_wallets";

export const agentStatusEnum = pgEnum("agent_status", ["active", "suspended", "revoked"]);

export const agentIdentitiesTable = pgTable("agent_identities", {
  id:               uuid("id").primaryKey().defaultRandom(),
  walletId:         uuid("wallet_id").notNull().references(() => agentWalletsTable.id, { onDelete: "cascade" }),
  ownerId:          uuid("owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name:             text("name").notNull(),
  apiKeyHash:       text("api_key_hash").notNull().unique(),
  status:           agentStatusEnum("status").notNull().default("active"),
  hourlyLimitCents: integer("hourly_limit_cents").notNull().default(200),
  perTxLimitCents:  integer("per_tx_limit_cents").notNull().default(10),
  dailyLimitCents:  integer("daily_limit_cents").notNull().default(1000),
  allowedDomains:   text("allowed_domains").array(),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt:       timestamp("last_seen_at", { withTimezone: true }),
});

export const insertAgentIdentitySchema = createInsertSchema(agentIdentitiesTable).omit({
  id: true,
  createdAt: true,
  lastSeenAt: true,
});

export type InsertAgentIdentity = typeof agentIdentitiesTable.$inferInsert;
export type AgentIdentity = typeof agentIdentitiesTable.$inferSelect;
