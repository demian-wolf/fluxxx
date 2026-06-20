import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { agentIdentitiesTable } from "./agent_identities";
import { agentWalletsTable } from "./agent_wallets";
import { ledgerEntriesTable } from "./ledger_entries";

export const transactionDecisionEnum = pgEnum("transaction_decision", ["pending", "approved", "rejected"]);

export const transactionRequestsTable = pgTable("transaction_requests", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  agentId:              uuid("agent_id").notNull().references(() => agentIdentitiesTable.id),
  walletId:             uuid("wallet_id").notNull().references(() => agentWalletsTable.id),
  requestedAmountCents: integer("requested_amount_cents").notNull(),
  payeeUrl:             text("payee_url").notNull(),
  description:          text("description").notNull(),
  decision:             transactionDecisionEnum("decision").notNull().default("pending"),
  rejectionReason:      text("rejection_reason"),
  paymentToken:         text("payment_token"),
  tokenExpiresAt:       timestamp("token_expires_at", { withTimezone: true }),
  ledgerEntryId:        uuid("ledger_entry_id").references(() => ledgerEntriesTable.id),
  createdAt:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTransactionRequestSchema = createInsertSchema(transactionRequestsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertTransactionRequest = typeof transactionRequestsTable.$inferInsert;
export type TransactionRequest = typeof transactionRequestsTable.$inferSelect;
