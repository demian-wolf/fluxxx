-- Capital Reclamation (Agentic Garbage Collection)
-- Records each GC sweep event when zombie agents are detected and their
-- stranded capital is reclaimed back up the agent spend tree.

DO $$ BEGIN
  CREATE TYPE "gc_reason" AS ENUM ('ttl_expired', 'agent_revoked', 'agent_suspended', 'parent_terminated');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "gc_events" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agent_id"              uuid NOT NULL REFERENCES "agent_identities"("id"),
  "wallet_id"             uuid NOT NULL REFERENCES "agent_wallets"("id"),
  "reason"                "gc_reason" NOT NULL,
  "reclaimed_cents"       integer NOT NULL DEFAULT 0,
  "daily_limit_freed"     integer NOT NULL DEFAULT 0,
  "refund_ledger_entry_id" uuid REFERENCES "ledger_entries"("id"),
  "agent_name"            text NOT NULL,
  "parent_agent_id"       uuid,
  "created_at"            timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "gc_events_wallet_id_idx" ON "gc_events" ("wallet_id");
CREATE INDEX IF NOT EXISTS "gc_events_agent_id_idx" ON "gc_events" ("agent_id");
CREATE INDEX IF NOT EXISTS "gc_events_created_at_idx" ON "gc_events" ("created_at" DESC);
