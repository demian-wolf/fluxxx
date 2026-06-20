import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer`);
  }
  return parsed;
}

export const config = {
  port: int("PORT", 3000),
  nodeEnv: process.env.NODE_ENV ?? "development",

  database: {
    url: required("DATABASE_URL"),
  },

  mollie: {
    apiKey: process.env.MOLLIE_API_KEY ?? "",
    webhookUrl: process.env.MOLLIE_WEBHOOK_URL ?? "",
    redirectUrl: process.env.MOLLIE_REDIRECT_URL ?? "",
  },

  flux: {
    jwtSecret: required("SESSION_SECRET", "dev_insecure_secret"),
    tokenTtlSeconds: int("FLUX_TOKEN_TTL_SECONDS", 30),
    sessionTtlSeconds: int("FLUX_SESSION_TTL_SECONDS", 86400),
    providerApiKey: process.env.FLUX_PROVIDER_API_KEY ?? "",
    appUrl: process.env.FLUX_APP_URL ?? "",
  },
} as const;

export type Config = typeof config;
