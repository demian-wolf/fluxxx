import { boolean, integer, jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { agentIdentitiesTable } from "./agent_identities";
import { usersTable } from "./users";

export const spendPoliciesTable = pgTable("spend_policies", {
  id:        uuid("id").primaryKey().defaultRandom(),
  agentId:   uuid("agent_id").notNull().references(() => agentIdentitiesTable.id, { onDelete: "cascade" }),
  version:   integer("version").notNull().default(1),
  rules:     jsonb("rules").notNull(),
  isActive:  boolean("is_active").notNull().default(true),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSpendPolicySchema = createInsertSchema(spendPoliciesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertSpendPolicy = typeof spendPoliciesTable.$inferInsert;
export type SpendPolicy = typeof spendPoliciesTable.$inferSelect;
