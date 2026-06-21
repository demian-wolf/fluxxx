CREATE TABLE IF NOT EXISTS "oob_kill_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "wallet_id" uuid NOT NULL REFERENCES "agent_wallets"("id"),
  "trigger_balance_cents" integer NOT NULL,
  "threshold_cents" integer NOT NULL,
  "agents_killed" integer NOT NULL DEFAULT 0,
  "tokens_invalidated" integer NOT NULL DEFAULT 0,
  "protected_agent_id" uuid REFERENCES "agent_identities"("id"),
  "protected_agent_name" text,
  "killed_agent_ids" text[],
  "killed_agent_names" text[],
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
