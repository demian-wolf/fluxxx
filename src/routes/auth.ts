import { Router } from "express";
import { store, findAgentByKeyHash } from "../store";
import { hashApiKey, issueSessionToken } from "../services/auth";
import { config } from "../config/env";
import { AgentStatus } from "../types";

const router = Router();

/**
 * POST /api/auth/agent
 * Agent presents its API key; FLUX validates and returns a short-lived JWT.
 * (backend-architecture.md section 2.1)
 */
router.post("/agent", (req, res) => {
  const apiKey: unknown = req.body?.agent_api_key;
  if (typeof apiKey !== "string" || apiKey === "") {
    res.status(400).json({ error: "missing_agent_api_key" });
    return;
  }

  const agent = findAgentByKeyHash(hashApiKey(apiKey));
  if (!agent || agent.status !== AgentStatus.Active) {
    res.status(401).json({ error: "invalid_agent_key" });
    return;
  }

  const walletId = agent.wallet_id;
  agent.last_seen_at = new Date().toISOString();

  const sessionToken = issueSessionToken(agent.id, walletId);
  const wallet = store.wallets.get(walletId);

  res.json({
    agent_id: agent.id,
    wallet_id: walletId,
    session_token: sessionToken,
    expires_in: config.flux.sessionTtlSeconds,
    balance_cents: wallet?.balance_cents ?? null,
    status: agent.status,
  });
});

export default router;
