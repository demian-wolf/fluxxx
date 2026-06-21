import { integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { agentIdentitiesTable } from "./agent_identities";
import { agentWalletsTable } from "./agent_wallets";
import { usersTable } from "./users";

export const agentAccessRequestStatusEnum = pgEnum("agent_access_request_status", [
  "pending",
  "approved",
  "denied",
  "expired",
]);

export const agentAccessRequestsTable = pgTable("agent_access_requests", {
  id:               uuid("id").primaryKey().defaultRandom(),
  walletId:         uuid("wallet_id").notNull().references(() => agentWalletsTable.id, { onDelete: "cascade" }),
  ownerId:          uuid("owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  requestCode:      text("request_code").notNull().unique(),
  agentName:        text("agent_name").notNull(),
  requestedScopes:  text("requested_scopes").array().notNull(),
  requestedMetadata: jsonb("requested_metadata").$type<Record<string, unknown>>().notNull(),
  hourlyLimitCents: integer("hourly_limit_cents"),
  perTxLimitCents:  integer("per_tx_limit_cents"),
  dailyLimitCents:  integer("daily_limit_cents"),
  allowedDomains:   text("allowed_domains").array(),
  blockedDomains:   text("blocked_domains").array(),
  status:           agentAccessRequestStatusEnum("status").notNull().default("pending"),
  statusReason:     text("status_reason"),
  reviewedBy:       uuid("reviewed_by").references(() => usersTable.id),
  agentId:          uuid("agent_id").references(() => agentIdentitiesTable.id),
  agentApiKeyOnce:  text("agent_api_key_once"),
  apiKeyDeliveredAt: timestamp("api_key_delivered_at", { withTimezone: true }),
  expiresAt:        timestamp("expires_at", { withTimezone: true }).notNull(),
  approvedAt:       timestamp("approved_at", { withTimezone: true }),
  deniedAt:         timestamp("denied_at", { withTimezone: true }),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAgentAccessRequestSchema = createInsertSchema(agentAccessRequestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAgentAccessRequest = typeof agentAccessRequestsTable.$inferInsert;
export type AgentAccessRequest = typeof agentAccessRequestsTable.$inferSelect;
