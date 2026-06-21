-- Migration: add parent_id column to agent_identities
-- Required by the agent process-tree feature (spawn/suspension cascade).
-- Idempotent: uses IF NOT EXISTS so safe to run on databases that already have the column.

ALTER TABLE "agent_identities"
  ADD COLUMN IF NOT EXISTS "parent_id" uuid REFERENCES "agent_identities" ("id") ON DELETE CASCADE;
