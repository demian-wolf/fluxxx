CREATE TYPE "public"."wallet_status" AS ENUM('active', 'suspended', 'depleted');--> statement-breakpoint
CREATE TYPE "public"."agent_status" AS ENUM('active', 'suspended', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_status" AS ENUM('pending', 'settled', 'failed', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('deposit', 'spend', 'fee', 'refund', 'hold', 'release');--> statement-breakpoint
CREATE TYPE "public"."mollie_payment_status" AS ENUM('open', 'pending', 'paid', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."transaction_decision" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"mollie_customer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "agent_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"balance_cents" integer DEFAULT 0 NOT NULL,
	"status" "wallet_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"api_key_hash" text NOT NULL,
	"status" "agent_status" DEFAULT 'active' NOT NULL,
	"hourly_limit_cents" integer DEFAULT 200 NOT NULL,
	"per_tx_limit_cents" integer DEFAULT 10 NOT NULL,
	"daily_limit_cents" integer DEFAULT 1000 NOT NULL,
	"fee_percent_bps" integer DEFAULT 150 NOT NULL,
	"allowed_domains" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "agent_identities_api_key_hash_unique" UNIQUE("api_key_hash")
);
--> statement-breakpoint
CREATE TABLE "spend_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"rules" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"agent_id" uuid,
	"type" "ledger_entry_type" NOT NULL,
	"amount_cents" integer NOT NULL,
	"balance_after_cents" integer NOT NULL,
	"description" text NOT NULL,
	"payee_url" text,
	"mollie_payment_id" text,
	"payment_token" text,
	"status" "ledger_entry_status" DEFAULT 'settled' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mollie_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"mollie_payment_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"method" text,
	"status" "mollie_payment_status" DEFAULT 'open' NOT NULL,
	"checkout_url" text NOT NULL,
	"webhook_received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mollie_payments_mollie_payment_id_unique" UNIQUE("mollie_payment_id")
);
--> statement-breakpoint
CREATE TABLE "transaction_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"requested_amount_cents" integer NOT NULL,
	"payee_url" text NOT NULL,
	"description" text NOT NULL,
	"decision" "transaction_decision" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"payment_token" text,
	"token_expires_at" timestamp with time zone,
	"ledger_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_wallets" ADD CONSTRAINT "agent_wallets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_identities" ADD CONSTRAINT "agent_identities_wallet_id_agent_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."agent_wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_identities" ADD CONSTRAINT "agent_identities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spend_policies" ADD CONSTRAINT "spend_policies_agent_id_agent_identities_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spend_policies" ADD CONSTRAINT "spend_policies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_wallet_id_agent_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."agent_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_agent_id_agent_identities_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mollie_payments" ADD CONSTRAINT "mollie_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mollie_payments" ADD CONSTRAINT "mollie_payments_wallet_id_agent_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."agent_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_requests" ADD CONSTRAINT "transaction_requests_agent_id_agent_identities_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_requests" ADD CONSTRAINT "transaction_requests_wallet_id_agent_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."agent_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_requests" ADD CONSTRAINT "transaction_requests_ledger_entry_id_ledger_entries_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "public"."ledger_entries"("id") ON DELETE no action ON UPDATE no action;