import { setTimeout as delay } from "node:timers/promises";
import { getJsonObjectFlag, getListFlag, getNumberFlag, getStringFlag, hasFlag, type ParsedCommand } from "./args";
import { ENDPOINTS } from "./endpoints";
import { isObject, numberField, stringField, withAgentApiKey, withRequestUpdate, withSession, writeConfig, writeJsonOutput } from "./config";
import { requestJson } from "./http";
import { commandResult, printHuman, printJson } from "./output";
import type { AgentAuthResponse, CommandContext, CommandResult, FluxAgentConfig, JsonObject } from "./types";

const APPROVED_STATUSES = new Set(["approved", "ready", "granted"]);
const TERMINAL_STATUSES = new Set(["approved", "ready", "granted", "denied", "rejected", "expired", "revoked"]);

export async function runCommand(ctx: CommandContext, parsed: ParsedCommand): Promise<CommandResult> {
  switch (parsed.command) {
    case "request-access":
      return requestAccess(ctx, parsed);
    case "status":
      return status(ctx, parsed);
    case "wait-access":
      return waitAccess(ctx, parsed);
    case "auth":
    case "login":
      return login(ctx, parsed);
    case "spend/request":
      return spendRequest(ctx, parsed);
    case "verify-provider-token":
      return verifyProviderToken(ctx, parsed);
    case "help":
    case "--help":
    case "-h":
      return help(ctx);
    default:
      throw new Error(`Unknown command: ${parsed.command}`);
  }
}

async function requestAccess(ctx: CommandContext, parsed: ParsedCommand): Promise<CommandResult> {
  const metadata = {
    ...getJsonObjectFlag(parsed.flags, ["metadata-json"]),
    purpose: requiredString(parsed, ["purpose"], "purpose"),
    ...(getStringFlag(parsed.flags, ["callback-url"]) ? { callback_url: getStringFlag(parsed.flags, ["callback-url"]) } : {}),
  };

  const body = compact({
    wallet_id: requiredString(parsed, ["wallet-id"], "wallet ID"),
    agent_name: requiredString(parsed, ["agent-name", "name"], "agent name"),
    requested_scopes: getListFlag(parsed.flags, ["scope", "scopes"]),
    limits: compact({
      hourly_limit_cents: getNumberFlag(parsed.flags, ["hourly-limit-cents"]),
      per_tx_limit_cents: getNumberFlag(parsed.flags, ["per-tx-limit-cents"]),
      daily_limit_cents: getNumberFlag(parsed.flags, ["daily-limit-cents"]),
      allowed_domains: getListFlag(parsed.flags, ["allowed-domain", "allowed-domains"]),
      blocked_domains: getListFlag(parsed.flags, ["blocked-domain", "blocked-domains"]),
    }),
    metadata,
    expires_in_seconds: getNumberFlag(parsed.flags, ["expires-in-seconds"]),
  });

  const { body: response } = await requestJson({
    apiBaseUrl: ctx.apiBaseUrl,
    endpoint: ENDPOINTS.agentAccessRequests,
    method: "POST",
    body,
  });

  const requestId = responseRequestId(response);
  const nextConfig = requestId ? withRequestUpdate(ctx.config, requestId, asObject(response), ctx.apiBaseUrl) : { ...ctx.config, apiBaseUrl: ctx.apiBaseUrl };
  const saved = await maybePersist(ctx, nextConfig);
  await maybeWriteOutput(ctx, response);
  emit(ctx, "request-access", response, saved);
  return commandResult(ctx, "request-access", response, saved);
}

async function status(ctx: CommandContext, parsed: ParsedCommand): Promise<CommandResult> {
  const requestId = requestIdFromInput(ctx.config, parsed);
  const requestCode = getStringFlag(parsed.flags, ["request-code", "code"]);
  const response = await fetchAccessStatus(ctx, requestId, requestCode);
  const nextConfig = configFromAccessResponse(ctx.config, requestId, response, ctx.apiBaseUrl);
  const saved = await maybePersist(ctx, nextConfig);
  await maybeWriteOutput(ctx, response);
  emit(ctx, "status", response, saved);
  return commandResult(ctx, "status", response, saved);
}

async function waitAccess(ctx: CommandContext, parsed: ParsedCommand): Promise<CommandResult> {
  const requestId = requestIdFromInput(ctx.config, parsed);
  const pollIntervalMs = getNumberFlag(parsed.flags, ["poll-interval-ms"]) ?? 2_000;
  const timeoutMs = getNumberFlag(parsed.flags, ["timeout-ms"]) ?? 300_000;
  const shouldLogin = hasFlag(parsed.flags, "login");
  const startedAt = Date.now();
  let response: unknown = {};

  while (Date.now() - startedAt <= timeoutMs) {
    response = await fetchAccessStatus(ctx, requestId, getStringFlag(parsed.flags, ["request-code", "code"]));
    const statusValue = normalizedStatus(response);
    if (statusValue && TERMINAL_STATUSES.has(statusValue)) break;
    await delay(pollIntervalMs);
  }

  let nextConfig = configFromAccessResponse(ctx.config, requestId, response, ctx.apiBaseUrl);
  if (shouldLogin && APPROVED_STATUSES.has(normalizedStatus(response) ?? "")) {
    const agentApiKey = apiKeyFromResponse(response) ?? nextConfig.agentApiKey;
    if (agentApiKey) {
      const auth = await authenticateAgent(ctx, agentApiKey);
      response = { access: response, session: auth };
      nextConfig = withSession(nextConfig, auth);
    }
  }

  const saved = await maybePersist(ctx, nextConfig);
  await maybeWriteOutput(ctx, response);
  emit(ctx, "wait-access", response, saved);
  return commandResult(ctx, "wait-access", response, saved);
}

async function login(ctx: CommandContext, parsed: ParsedCommand): Promise<CommandResult> {
  const agentApiKey = getStringFlag(parsed.flags, ["agent-api-key", "api-key"]) ?? process.env.FLUX_AGENT_API_KEY ?? ctx.config.agentApiKey;
  if (!agentApiKey) {
    throw new Error("Missing agent API key. Pass --agent-api-key, set FLUX_AGENT_API_KEY, or run wait-access first.");
  }

  const response = await authenticateAgent(ctx, agentApiKey);
  const nextConfig = withSession(withAgentApiKey({ ...ctx.config, apiBaseUrl: ctx.apiBaseUrl }, agentApiKey), response);
  const saved = await maybePersist(ctx, nextConfig);
  await maybeWriteOutput(ctx, response);
  emit(ctx, parsed.command, response, saved);
  return commandResult(ctx, parsed.command, response, saved);
}

async function spendRequest(ctx: CommandContext, parsed: ParsedCommand): Promise<CommandResult> {
  const sessionToken = getStringFlag(parsed.flags, ["session-token"]) ?? process.env.FLUX_SESSION_TOKEN ?? ctx.config.session?.token;
  if (!sessionToken) {
    throw new Error("Missing session token. Run login first, pass --session-token, or set FLUX_SESSION_TOKEN.");
  }

  const body = compact({
    amount_cents: requiredNumber(parsed, ["amount-cents"], "amount in cents"),
    payee_url: requiredString(parsed, ["payee-url"], "payee URL"),
    description: getStringFlag(parsed.flags, ["description"]),
  });

  const { body: response, status: httpStatus } = await requestJson({
    apiBaseUrl: ctx.apiBaseUrl,
    endpoint: ENDPOINTS.transactionRequest,
    method: "POST",
    body,
    headers: { authorization: `Bearer ${sessionToken}` },
    allowStatuses: [402],
  });

  await maybeWriteOutput(ctx, response);
  emit(ctx, "spend/request", response, false);
  if (httpStatus === 402) process.exitCode = 2;
  return commandResult(ctx, "spend/request", response, false);
}

async function verifyProviderToken(ctx: CommandContext, parsed: ParsedCommand): Promise<CommandResult> {
  const providerKey = getStringFlag(parsed.flags, ["provider-key"]) ?? process.env.FLUX_PROVIDER_API_KEY;
  if (!providerKey) {
    throw new Error("Missing provider key. Pass --provider-key or set FLUX_PROVIDER_API_KEY.");
  }

  const body = compact({
    payment_token: requiredString(parsed, ["payment-token"], "payment token"),
    expected_amount_cents: getNumberFlag(parsed.flags, ["expected-amount-cents"]),
  });

  const { body: response } = await requestJson({
    apiBaseUrl: ctx.apiBaseUrl,
    endpoint: ENDPOINTS.tokenVerify,
    method: "POST",
    body,
    headers: { "x-flux-provider-key": providerKey },
  });

  await maybeWriteOutput(ctx, response);
  emit(ctx, "verify-provider-token", response, false);
  return commandResult(ctx, "verify-provider-token", response, false);
}

function help(ctx: CommandContext): CommandResult {
  const text = `flux-agent

Usage:
  flux-agent request-access --wallet-id <id> --agent-name <name> --purpose <text> [--scope payments:spend] [--json]
  flux-agent wait-access --request-id <id> [--request-code <code>] [--login] [--json]
  flux-agent status [--request-id <id>] [--request-code <code>] [--json]
  flux-agent login --agent-api-key <key> [--json]
  flux-agent spend request --amount-cents <n> --payee-url <url> [--description <text>] [--json]
  flux-agent verify-provider-token --payment-token <token> --provider-key <key> [--json]

Global options:
  --api-base-url <url>   Defaults to FLUX_API_BASE_URL, saved config, or http://localhost:3000
  --config <path>        Defaults to FLUX_AGENT_CONFIG or ~/.config/flux-agent/config.json
  --no-save              Do not write request IDs, API keys, or session tokens to config
  --output <path>        Write the command response JSON to a 0600 file
  --json                 Print machine-readable JSON
  --show-secrets         Print secrets in human-readable output
`;
  process.stdout.write(text);
  return commandResult(ctx, "help", {}, false);
}

async function fetchAccessStatus(ctx: CommandContext, requestId: string, requestCodeOverride?: string): Promise<unknown> {
  const requestCode = requestCodeFor(ctx, requestId, requestCodeOverride);
  const { body } = await requestJson({
    apiBaseUrl: ctx.apiBaseUrl,
    endpoint: ENDPOINTS.agentAccessRequest(requestId),
    method: "GET",
    headers: requestCode ? { "x-flux-request-code": requestCode } : undefined,
  });
  return body;
}

async function authenticateAgent(ctx: CommandContext, agentApiKey: string): Promise<AgentAuthResponse> {
  const { body } = await requestJson({
    apiBaseUrl: ctx.apiBaseUrl,
    endpoint: ENDPOINTS.agentAuth,
    method: "POST",
    body: { agent_api_key: agentApiKey },
  });

  if (!isObject(body)) return {};
  return {
    agent_id: stringField(body, "agent_id"),
    wallet_id: stringField(body, "wallet_id"),
    session_token: stringField(body, "session_token"),
    expires_in: numberField(body, "expires_in"),
    balance_cents: typeof body.balance_cents === "number" || body.balance_cents === null ? body.balance_cents : undefined,
    status: stringField(body, "status"),
  };
}

function configFromAccessResponse(config: FluxAgentConfig, requestId: string, response: unknown, apiBaseUrl: string): FluxAgentConfig {
  const body = asObject(response);
  return withAgentApiKey(withRequestUpdate({ ...config, apiBaseUrl }, requestId, body, apiBaseUrl), apiKeyFromResponse(body));
}

async function maybePersist(ctx: CommandContext, config: FluxAgentConfig): Promise<boolean> {
  if (!ctx.save) return false;
  await writeConfig(ctx.configPath, config);
  return true;
}

async function maybeWriteOutput(ctx: CommandContext, data: unknown): Promise<void> {
  if (ctx.outputPath) await writeJsonOutput(ctx.outputPath, data);
}

function emit(ctx: CommandContext, command: string, data: unknown, saved: boolean): void {
  if (ctx.json) {
    printJson(commandResult(ctx, command, data, saved));
    return;
  }
  printHuman(ctx, command, data, saved);
}

function requestIdFromInput(config: FluxAgentConfig, parsed: ParsedCommand): string {
  const requestId = getStringFlag(parsed.flags, ["request-id"]) ?? parsed.positionals[0] ?? config.lastRequestId;
  if (!requestId) {
    throw new Error("Missing request ID. Pass --request-id or run request-access first.");
  }
  return requestId;
}

function requestCodeFor(ctx: CommandContext, requestId: string, requestCodeOverride?: string): string | undefined {
  return requestCodeOverride ?? process.env.FLUX_AGENT_ACCESS_REQUEST_CODE ?? ctx.config.requests?.[requestId]?.requestCode;
}

function requiredString(parsed: ParsedCommand, names: string[], label: string): string {
  const value = getStringFlag(parsed.flags, names);
  if (!value) throw new Error(`Missing ${label}. Pass --${names[0]}.`);
  return value;
}

function requiredNumber(parsed: ParsedCommand, names: string[], label: string): number {
  const value = getNumberFlag(parsed.flags, names);
  if (value === undefined) throw new Error(`Missing ${label}. Pass --${names[0]}.`);
  return value;
}

function responseRequestId(response: unknown): string | undefined {
  if (!isObject(response)) return undefined;
  return stringField(response, "request_id") ?? stringField(response, "id");
}

function apiKeyFromResponse(response: unknown): string | undefined {
  if (!isObject(response)) return undefined;
  return stringField(response, "agent_api_key") ?? stringField(response, "api_key");
}

function normalizedStatus(response: unknown): string | undefined {
  if (!isObject(response)) return undefined;
  const status = stringField(response, "status");
  return status?.toLowerCase();
}

function asObject(value: unknown): JsonObject {
  return isObject(value) ? value : {};
}

function compact(input: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (value === undefined) return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    }),
  );
}
