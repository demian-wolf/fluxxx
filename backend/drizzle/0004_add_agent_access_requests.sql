DO $$ BEGIN
  CREATE TYPE "agent_access_request_status" AS ENUM ('pending', 'approved', 'denied', 'expired');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "agent_access_requests" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "wallet_id"             uuid NOT NULL REFERENCES "agent_wallets" ("id") ON DELETE CASCADE,
  "owner_id"              uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "request_code"          text NOT NULL UNIQUE,
  "agent_name"            text NOT NULL,
  "requested_scopes"      text[] DEFAULT '{}'::text[] NOT NULL,
  "requested_metadata"    jsonb DEFAULT '{}'::jsonb NOT NULL,
  "hourly_limit_cents"    integer,
  "per_tx_limit_cents"    integer,
  "daily_limit_cents"     integer,
  "allowed_domains"       text[],
  "blocked_domains"       text[],
  "status"                "agent_access_request_status" DEFAULT 'pending' NOT NULL,
  "status_reason"         text,
  "reviewed_by"           uuid REFERENCES "users" ("id"),
  "agent_id"              uuid REFERENCES "agent_identities" ("id") ON DELETE SET NULL,
  "agent_api_key_once"    text,
  "api_key_delivered_at"  timestamptz,
  "expires_at"            timestamptz NOT NULL,
  "approved_at"           timestamptz,
  "denied_at"             timestamptz,
  "created_at"            timestamptz DEFAULT now() NOT NULL,
  "updated_at"            timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "agent_access_requests_owner_status_idx"
  ON "agent_access_requests" ("owner_id", "status", "created_at");

CREATE INDEX IF NOT EXISTS "agent_access_requests_wallet_status_idx"
  ON "agent_access_requests" ("wallet_id", "status");

CREATE INDEX IF NOT EXISTS "agent_access_requests_pending_expiry_idx"
  ON "agent_access_requests" ("expires_at")
  WHERE "status" = 'pending';
