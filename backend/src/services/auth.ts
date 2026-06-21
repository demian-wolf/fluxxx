import crypto from "crypto";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { UUID } from "../types";

const AGENT_KEY_PREFIX = "flux_sk_live_";
const SESSION_AUDIENCE = "flux:agent-session";
const USER_AUDIENCE = "flux:user-session";

export interface AgentSessionClaims {
  sub: UUID; // agent_id
  wallet_id: UUID;
  aud: typeof SESSION_AUDIENCE;
}

export interface UserSessionClaims {
  sub: UUID; // user_id
  email: string;
  aud: typeof USER_AUDIENCE;
}

/** Generate a new raw agent API key. Shown to the operator exactly once. */
export function generateAgentApiKey(): string {
  return AGENT_KEY_PREFIX + crypto.randomBytes(24).toString("hex");
}

/** SHA-256 hash an API key for long-term credential storage. */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

/** Mint a short-lived agent session JWT. */
export function issueSessionToken(agentId: UUID, walletId: UUID): string {
  const claims: AgentSessionClaims = {
    sub: agentId,
    wallet_id: walletId,
    aud: SESSION_AUDIENCE,
  };
  return jwt.sign(claims, config.flux.jwtSecret, {
    expiresIn: config.flux.sessionTtlSeconds,
  });
}

/** Verify and decode an agent session JWT. Throws on invalid/expired tokens. */
export function verifySessionToken(token: string): AgentSessionClaims {
  const decoded = jwt.verify(token, config.flux.jwtSecret, {
    audience: SESSION_AUDIENCE,
  });
  return decoded as AgentSessionClaims;
}

/** Generate a single-use payment token issued to an agent on approval. */
export function generatePaymentToken(): string {
  return "flux_tok_" + crypto.randomBytes(16).toString("hex");
}

/** Mint a JWT for a human operator session. */
export function issueUserToken(userId: UUID, email: string): string {
  const claims: UserSessionClaims = {
    sub: userId,
    email,
    aud: USER_AUDIENCE,
  };
  return jwt.sign(claims, config.flux.jwtSecret, {
    expiresIn: config.flux.sessionTtlSeconds,
  });
}

/** Verify and decode a human operator JWT. Throws on invalid/expired tokens. */
export function verifyUserToken(token: string): UserSessionClaims {
  const decoded = jwt.verify(token, config.flux.jwtSecret, {
    audience: USER_AUDIENCE,
  });
  return decoded as UserSessionClaims;
}
