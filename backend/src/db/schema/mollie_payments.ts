import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";
import { agentWalletsTable } from "./agent_wallets";

export const molliePaymentStatusEnum = pgEnum("mollie_payment_status", ["open", "pending", "paid", "failed", "expired"]);

export const molliePaymentsTable = pgTable("mollie_payments", {
  id:                uuid("id").primaryKey().defaultRandom(),
  userId:            uuid("user_id").notNull().references(() => usersTable.id),
  walletId:          uuid("wallet_id").notNull().references(() => agentWalletsTable.id),
  molliePaymentId:   text("mollie_payment_id").notNull().unique(),
  amountCents:       integer("amount_cents").notNull(),
  method:            text("method"),
  status:            molliePaymentStatusEnum("status").notNull().default("open"),
  checkoutUrl:       text("checkout_url").notNull(),
  webhookReceivedAt: timestamp("webhook_received_at", { withTimezone: true }),
  createdAt:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMolliePaymentSchema = createInsertSchema(molliePaymentsTable).omit({
  id: true,
  createdAt: true,
  webhookReceivedAt: true,
});

export type InsertMolliePayment = typeof molliePaymentsTable.$inferInsert;
export type MolliePayment = typeof molliePaymentsTable.$inferSelect;
