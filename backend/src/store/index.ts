/**
 * In-memory data store standing in for Base44's entity store.
 *
 * This is a skeleton placeholder: swap each collection for the corresponding
 * Base44 entity / database table when wiring up real persistence.
 */
import {
  User,
  AgentWallet,
  AgentIdentity,
  SpendPolicy,
  LedgerEntry,
  MolliePayment,
  TransactionRequest,
} from "../models";

export interface Store {
  users: Map<string, User>;
  wallets: Map<string, AgentWallet>;
  agents: Map<string, AgentIdentity>;
  policies: Map<string, SpendPolicy>;
  ledger: Map<string, LedgerEntry>;
  molliePayments: Map<string, MolliePayment>;
  transactions: Map<string, TransactionRequest>;
}

export const store: Store = {
  users: new Map(),
  wallets: new Map(),
  agents: new Map(),
  policies: new Map(),
  ledger: new Map(),
  molliePayments: new Map(),
  transactions: new Map(),
};

/** Find the single active SpendPolicy for an agent, if any. */
export function findActivePolicy(agentId: string): SpendPolicy | undefined {
  for (const policy of store.policies.values()) {
    if (policy.agent_id === agentId && policy.is_active) return policy;
  }
  return undefined;
}

/** Find an agent by the SHA-256 hash of its API key. */
export function findAgentByKeyHash(hash: string): AgentIdentity | undefined {
  for (const agent of store.agents.values()) {
    if (agent.api_key_hash === hash) return agent;
  }
  return undefined;
}

/** All ledger entries for a wallet, oldest first. */
export function ledgerForWallet(walletId: string): LedgerEntry[] {
  return [...store.ledger.values()]
    .filter((entry) => entry.wallet_id === walletId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}
