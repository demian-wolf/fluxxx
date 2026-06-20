/**
 * KYA Policy Engine — implements the state machine in backend-architecture.md
 * section 3. Evaluates a transaction request against the agent's active policy,
 * rolling spend windows, wallet balance, and domain rules.
 */
import { AgentIdentity, AgentWallet, SpendPolicy } from "../models";
import { AgentStatus, RejectionReason } from "../types";
import { spentInWindow } from "./ledger";

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

export interface EvaluationInput {
  agent: AgentIdentity;
  wallet: AgentWallet;
  policy: SpendPolicy | undefined;
  amountCents: number;
  payeeUrl: string;
  description: string;
}

export interface ApprovedResult {
  approved: true;
}

export interface RejectedResult {
  approved: false;
  reason: RejectionReason;
  details?: Record<string, number>;
}

export type EvaluationResult = ApprovedResult | RejectedResult;

function reject(
  reason: RejectionReason,
  details?: Record<string, number>,
): RejectedResult {
  return { approved: false, reason, details };
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Run the full policy evaluation chain. Returns the first failing check, or an
 * approval if every check passes. This function is side-effect free; callers
 * perform the atomic deduct + ledger write on approval.
 */
export function evaluate(input: EvaluationInput): EvaluationResult {
  const { agent, wallet, policy, amountCents, payeeUrl, description } = input;

  // Effective limits: policy rules override the agent defaults when present.
  const perTxLimit = policy?.rules.per_tx_limit_cents ?? agent.per_tx_limit_cents;
  const hourlyLimit = policy?.rules.hourly_limit_cents ?? agent.hourly_limit_cents;
  const dailyLimit = policy?.rules.daily_limit_cents ?? agent.daily_limit_cents;

  if (agent.status !== AgentStatus.Active) {
    return reject(RejectionReason.AgentSuspended);
  }

  if (policy?.rules.require_description && description.trim() === "") {
    return reject(RejectionReason.MissingDescription);
  }

  // [Check per_tx_limit]
  if (amountCents > perTxLimit) {
    return reject(RejectionReason.PerTxLimitExceeded, {
      requested_cents: amountCents,
      per_tx_limit_cents: perTxLimit,
    });
  }

  // [Check hourly rolling window]
  const hourlySpent = spentInWindow(wallet.id, agent.id, ONE_HOUR_MS);
  if (hourlySpent + amountCents > hourlyLimit) {
    return reject(RejectionReason.HourlyLimitExceeded, {
      hourly_spent_cents: hourlySpent,
      hourly_limit_cents: hourlyLimit,
    });
  }

  // [Check daily rolling window]
  const dailySpent = spentInWindow(wallet.id, agent.id, ONE_DAY_MS);
  if (dailySpent + amountCents > dailyLimit) {
    return reject(RejectionReason.DailyLimitExceeded, {
      daily_spent_cents: dailySpent,
      daily_limit_cents: dailyLimit,
    });
  }

  // [Check wallet balance]
  if (wallet.balance_cents < amountCents) {
    return reject(RejectionReason.InsufficientBalance, {
      balance_cents: wallet.balance_cents,
      requested_cents: amountCents,
    });
  }

  // [Check domain allowlist / blocklist]
  const domain = domainOf(payeeUrl);
  const blocked = policy?.rules.blocked_domains ?? [];
  if (blocked.includes(domain)) {
    return reject(RejectionReason.DomainBlocked);
  }
  if (agent.allowed_domains.length > 0 && !agent.allowed_domains.includes(domain)) {
    return reject(RejectionReason.DomainBlocked);
  }

  return { approved: true };
}
