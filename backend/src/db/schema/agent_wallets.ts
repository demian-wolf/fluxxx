import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const walletStatusEnum = pgEnum("wallet_status", ["active", "suspended", "depleted"]);

export const agentWalletsTable = pgTable("agent_wallets", {
  id:           uuid("id").primaryKey().defaultRandom(),
  ownerId:      uuid("owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name:         text("name").notNull(),
  balanceCents: integer("balance_cents").notNull().default(0),
  status:       walletStatusEnum("status").notNull().default("active"),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAgentWalletSchema = createInsertSchema(agentWalletsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAgentWallet = typeof agentWalletsTable.$inferInsert;
export type AgentWallet = typeof agentWalletsTable.$inferSelect;
