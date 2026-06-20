import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { usersTable, agentIdentitiesTable, agentWalletsTable } from "../db/schema";
import { hashApiKey, issueSessionToken, issueUserToken, verifyUserToken } from "../services/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { config } from "../config/env";

const router = Router();

/**
 * POST /api/auth/register
 * Human operator creates an account.
 */
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { email, full_name, password } = req.body ?? {};
    if (typeof email !== "string" || typeof full_name !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "missing_required_fields" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "password_too_short" });
      return;
    }

    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "email_already_registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db
      .insert(usersTable)
      .values({ email: email.toLowerCase(), fullName: full_name, passwordHash })
      .returning({ id: usersTable.id, email: usersTable.email, fullName: usersTable.fullName, createdAt: usersTable.createdAt });

    const token = issueUserToken(user.id, user.email);
    res.status(201).json({
      user_id: user.id,
      email: user.email,
      full_name: user.fullName,
      token,
      expires_in: config.flux.sessionTtlSeconds,
    });
  }),
);

/**
 * POST /api/auth/login
 * Human operator logs in with email + password.
 */
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "missing_required_fields" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (!user) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }

    const token = issueUserToken(user.id, user.email);
    res.json({
      user_id: user.id,
      email: user.email,
      full_name: user.fullName,
      token,
      expires_in: config.flux.sessionTtlSeconds,
    });
  }),
);

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's profile.
 */
router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const authHeader = req.header("authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      res.status(401).json({ error: "missing_user_token" });
      return;
    }
    let userId: string;
    try {
      const claims = verifyUserToken(authHeader.slice(7).trim());
      userId = claims.sub;
    } catch {
      res.status(401).json({ error: "invalid_user_token" });
      return;
    }

    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email, fullName: usersTable.fullName, mollieCustomerId: usersTable.mollieCustomerId, createdAt: usersTable.createdAt })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }
    res.json(user);
  }),
);

/**
 * POST /api/auth/agent
 * Agent presents its API key; FLUX validates and returns a short-lived JWT.
 * (backend-architecture.md section 2.1)
 */
router.post(
  "/agent",
  asyncHandler(async (req, res) => {
    const apiKey: unknown = req.body?.agent_api_key;
    if (typeof apiKey !== "string" || apiKey === "") {
      res.status(400).json({ error: "missing_agent_api_key" });
      return;
    }

    const keyHash = hashApiKey(apiKey);
    const [agent] = await db
      .select()
      .from(agentIdentitiesTable)
      .where(eq(agentIdentitiesTable.apiKeyHash, keyHash))
      .limit(1);

    if (!agent || agent.status !== "active") {
      res.status(401).json({ error: "invalid_agent_key" });
      return;
    }

    await db
      .update(agentIdentitiesTable)
      .set({ lastSeenAt: new Date() })
      .where(eq(agentIdentitiesTable.id, agent.id));

    const [wallet] = await db
      .select({ balanceCents: agentWalletsTable.balanceCents })
      .from(agentWalletsTable)
      .where(eq(agentWalletsTable.id, agent.walletId))
      .limit(1);

    const sessionToken = issueSessionToken(agent.id, agent.walletId);
    res.json({
      agent_id: agent.id,
      wallet_id: agent.walletId,
      session_token: sessionToken,
      expires_in: config.flux.sessionTtlSeconds,
      balance_cents: wallet?.balanceCents ?? null,
      status: agent.status,
    });
  }),
);

export default router;
