import { integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { agentWalletsTable } from "./agent_wallets";
import { agentIdentitiesTable } from "./agent_identities";

export const ledgerEntryTypeEnum   = pgEnum("ledger_entry_type",   ["deposit", "spend", "fee", "refund", "hold", "release"]);
export const ledgerEntryStatusEnum = pgEnum("ledger_entry_status", ["pending", "settled", "failed", "reversed"]);

export const ledgerEntriesTable = pgTable("ledger_entries", {
  id:                uuid("id").primaryKey().defaultRandom(),
  walletId:          uuid("wallet_id").notNull().references(() => agentWalletsTable.id),
  agentId:           uuid("agent_id").references(() => agentIdentitiesTable.id),
  type:              ledgerEntryTypeEnum("type").notNull(),
  amountCents:       integer("amount_cents").notNull(),
  balanceAfterCents: integer("balance_after_cents").notNull(),
  description:       text("description").notNull(),
  payeeUrl:          text("payee_url"),
  molliePaymentId:   text("mollie_payment_id"),
  paymentToken:      text("payment_token"),
  status:            ledgerEntryStatusEnum("status").notNull().default("settled"),
  metadata:          jsonb("metadata"),
  createdAt:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLedgerEntrySchema = createInsertSchema(ledgerEntriesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertLedgerEntry = typeof ledgerEntriesTable.$inferInsert;
export type LedgerEntry = typeof ledgerEntriesTable.$inferSelect;
