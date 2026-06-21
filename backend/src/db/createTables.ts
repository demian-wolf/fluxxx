import postgres from "postgres";
import { config } from "../config/env";

/**
 * Idempotent schema bootstrap: creates every enum and table the application
 * needs only if it does not already exist. Safe to run repeatedly.
 *
 * Run with: npm run db:create
 *
 * Enums are guarded with a DO block because Postgres has no
 * `CREATE TYPE ... IF NOT EXISTS`.
 */
const CREATE_SCHEMA_SQL = /* sql */ `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE "wallet_status" AS ENUM ('active', 'suspended', 'depleted');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "agent_status" AS ENUM ('active', 'suspended', 'revoked');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "transaction_decision" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ledger_entry_type" AS ENUM ('deposit', 'spend', 'refund', 'hold', 'release');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ledger_entry_status" AS ENUM ('pending', 'settled', 'failed', 'reversed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "mollie_payment_status" AS ENUM ('open', 'pending', 'paid', 'failed', 'expired');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "users" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email"              text NOT NULL UNIQUE,
  "full_name"          text NOT NULL,
  "password_hash"      text NOT NULL,
  "mollie_customer_id" text,
  "created_at"         timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "agent_wallets" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id"      uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "name"          text NOT NULL,
  "balance_cents" integer DEFAULT 0 NOT NULL,
  "currency"      text DEFAULT 'EUR' NOT NULL,
  "status"        "wallet_status" DEFAULT 'active' NOT NULL,
  "created_at"    timestamptz DEFAULT now() NOT NULL,
  "updated_at"    timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "agent_identities" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "wallet_id"          uuid NOT NULL REFERENCES "agent_wallets" ("id") ON DELETE CASCADE,
  "owner_id"           uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "parent_id"          uuid REFERENCES "agent_identities" ("id") ON DELETE CASCADE,
  "name"               text NOT NULL,
  "api_key_hash"       text NOT NULL UNIQUE,
  "status"             "agent_status" DEFAULT 'active' NOT NULL,
  "hourly_limit_cents" integer DEFAULT 200 NOT NULL,
  "per_tx_limit_cents" integer DEFAULT 10 NOT NULL,
  "daily_limit_cents"  integer DEFAULT 1000 NOT NULL,
  "allowed_domains"    text[],
  "created_at"         timestamptz DEFAULT now() NOT NULL,
  "last_seen_at"       timestamptz
);

CREATE TABLE IF NOT EXISTS "spend_policies" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent_id"   uuid NOT NULL REFERENCES "agent_identities" ("id") ON DELETE CASCADE,
  "version"    integer DEFAULT 1 NOT NULL,
  "rules"      jsonb NOT NULL,
  "is_active"  boolean DEFAULT true NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users" ("id"),
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ledger_entries" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "wallet_id"           uuid NOT NULL REFERENCES "agent_wallets" ("id"),
  "agent_id"            uuid REFERENCES "agent_identities" ("id"),
  "type"                "ledger_entry_type" NOT NULL,
  "amount_cents"        integer NOT NULL,
  "balance_after_cents" integer NOT NULL,
  "description"         text NOT NULL,
  "payee_url"           text,
  "mollie_payment_id"   text,
  "payment_token"       text,
  "status"              "ledger_entry_status" DEFAULT 'settled' NOT NULL,
  "metadata"            jsonb,
  "created_at"          timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "transaction_requests" (
  "id"                     uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent_id"               uuid NOT NULL REFERENCES "agent_identities" ("id"),
  "wallet_id"              uuid NOT NULL REFERENCES "agent_wallets" ("id"),
  "requested_amount_cents" integer NOT NULL,
  "payee_url"              text NOT NULL,
  "description"            text NOT NULL,
  "decision"               "transaction_decision" DEFAULT 'pending' NOT NULL,
  "rejection_reason"       text,
  "payment_token"          text,
  "token_expires_at"       timestamptz,
  "ledger_entry_id"        uuid REFERENCES "ledger_entries" ("id"),
  "created_at"             timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "mollie_payments" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"             uuid NOT NULL REFERENCES "users" ("id"),
  "wallet_id"           uuid NOT NULL REFERENCES "agent_wallets" ("id"),
  "mollie_payment_id"   text NOT NULL UNIQUE,
  "amount_cents"        integer NOT NULL,
  "currency"            text DEFAULT 'EUR' NOT NULL,
  "method"              text,
  "status"              "mollie_payment_status" DEFAULT 'open' NOT NULL,
  "checkout_url"        text NOT NULL,
  "webhook_received_at" timestamptz,
  "created_at"          timestamptz DEFAULT now() NOT NULL
);

-- Backfill the agent process-tree column on databases created before it existed.
ALTER TABLE "agent_identities"
  ADD COLUMN IF NOT EXISTS "parent_id" uuid REFERENCES "agent_identities" ("id") ON DELETE CASCADE;
`;

async function main(): Promise<void> {
  const sql = postgres(config.database.url, {
    max: 1,
    ssl: config.nodeEnv === "production" ? "require" : undefined,
    onnotice: (notice) => {
      // eslint-disable-next-line no-console
      console.log(`  ${notice.message}`);
    },
  });

  try {
    await sql.unsafe(CREATE_SCHEMA_SQL);
    // eslint-disable-next-line no-console
    console.log("Schema is up to date (created any missing enums and tables).");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to create schema:", err);
  process.exit(1);
});
