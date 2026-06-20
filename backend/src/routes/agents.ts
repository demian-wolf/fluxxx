import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { store } from "../store";
import { generateAgentApiKey, hashApiKey } from "../services/auth";
import { AgentIdentity } from "../models";
import { AgentStatus } from "../types";
import { userAuth } from "../middleware/userAuth";

const router = Router();

/**
 * POST /api/agents/register
 * Operator creates a new agent identity and receives the API key (shown once).
 * (backend-architecture.md section 2.6)
 */
router.post("/register", userAuth, (req, res) => {
  const {
    wallet_id,
    name,
    hourly_limit_cents,
    per_tx_limit_cents,
    daily_limit_cents,
    allowed_domains,
  } = req.body ?? {};

  if (typeof wallet_id !== "string" || typeof name !== "string") {
    res.status(400).json({ error: "missing_required_fields" });
    return;
  }

  const wallet = store.wallets.get(wallet_id);
  if (!wallet) {
    res.status(404).json({ error: "wallet_not_found" });
    return;
  }

  const rawKey = generateAgentApiKey();
  const now = new Date().toISOString();
  const agent: AgentIdentity = {
    id: uuidv4(),
    wallet_id,
    owner_id: req.userId as string,
    name,
    api_key_hash: hashApiKey(rawKey),
    status: AgentStatus.Active,
    hourly_limit_cents: Number(hourly_limit_cents ?? 0),
    per_tx_limit_cents: Number(per_tx_limit_cents ?? 0),
    daily_limit_cents: Number(daily_limit_cents ?? 0),
    allowed_domains: Array.isArray(allowed_domains) ? allowed_domains : [],
    created_at: now,
    last_seen_at: null,
  };
  store.agents.set(agent.id, agent);

  res.status(201).json({
    agent_id: agent.id,
    api_key: rawKey,
    warning: "Store this key securely. It will not be shown again.",
  });
});

export default router;
