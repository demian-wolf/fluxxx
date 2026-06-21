import type { CommandContext, CommandResult, JsonObject } from "./types";
import { isObject } from "./config";

const SECRET_KEYS = new Set([
  "agent_api_key",
  "api_key",
  "session_token",
  "token",
  "provider_key",
  "payment_token",
]);

export function commandResult(ctx: CommandContext, command: string, data: unknown, saved: boolean): CommandResult {
  return {
    ok: true,
    command,
    apiBaseUrl: ctx.apiBaseUrl,
    saved,
    configPath: ctx.configPath,
    data,
  };
}

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printHuman(ctx: CommandContext, command: string, data: unknown, saved: boolean): void {
  if (command === "request-access") {
    printRequestAccess(ctx, data, saved);
    return;
  }
  if (command === "status" || command === "wait-access") {
    printStatus(ctx, data, saved);
    return;
  }
  if (command === "login" || command === "auth") {
    printLogin(ctx, data, saved);
    return;
  }
  if (command === "spend/request") {
    printSpend(data);
    return;
  }
  if (command === "verify-provider-token") {
    printProviderVerify(data);
    return;
  }

  process.stdout.write(`${JSON.stringify(redact(data, ctx.showSecrets), null, 2)}\n`);
}

export function errorPayload(command: string, error: unknown): JsonObject {
  if (error instanceof Error) {
    const status = "status" in error && typeof error.status === "number" ? error.status : undefined;
    const body = "body" in error ? error.body : undefined;
    return { ok: false, command, error: error.message, ...(status === undefined ? {} : { status }), ...(body === undefined ? {} : { body }) };
  }
  return { ok: false, command, error: String(error) };
}

function printRequestAccess(ctx: CommandContext, data: unknown, saved: boolean): void {
  const body = asJson(data);
  process.stdout.write("Agent access request created\n");
  printField("request_id", stringish(body.request_id ?? body.id));
  printField("request_code", stringish(body.request_code ?? body.requestCode));
  printField("status", stringish(body.status));
  printField("approval_url", stringish(body.approval_url ?? body.approvalUrl));
  printField("status_url", stringish(body.status_url ?? body.statusUrl));
  if (saved) printField("config", ctx.configPath);
}

function printStatus(ctx: CommandContext, data: unknown, saved: boolean): void {
  const body = asJson(data);
  process.stdout.write("Agent access request status\n");
  printField("request_id", stringish(body.request_id ?? body.id));
  printField("status", stringish(body.status));
  printField("agent_id", stringish(body.agent_id ?? body.agentId));
  printField("wallet_id", stringish(body.wallet_id ?? body.walletId));
  printField("status_reason", stringish(body.status_reason ?? body.statusReason));
  printSecretField(ctx, "agent_api_key", stringish(body.agent_api_key ?? body.api_key));
  printSecretField(ctx, "session_token", stringish(body.session_token));
  if (saved) printField("config", ctx.configPath);
}

function printLogin(ctx: CommandContext, data: unknown, saved: boolean): void {
  const body = asJson(data);
  process.stdout.write("Agent session ready\n");
  printField("agent_id", stringish(body.agent_id));
  printField("wallet_id", stringish(body.wallet_id));
  printField("expires_in", stringish(body.expires_in));
  printField("balance_cents", stringish(body.balance_cents));
  printSecretField(ctx, "session_token", stringish(body.session_token));
  if (saved) printField("config", ctx.configPath);
}

function printSpend(data: unknown): void {
  const body = asJson(data);
  process.stdout.write("Spend request result\n");
  printField("decision", stringish(body.decision));
  printField("transaction_id", stringish(body.transaction_id));
  printField("payment_token", body.payment_token ? "[saved/redacted]" : undefined);
  printField("token_expires_at", stringish(body.token_expires_at));
  printField("rejection_reason", stringish(body.rejection_reason));
  printField("balance_after_cents", stringish(body.balance_after_cents));
}

function printProviderVerify(data: unknown): void {
  const body = asJson(data);
  process.stdout.write("Provider token verification\n");
  printField("valid", stringish(body.valid));
  printField("agent_id", stringish(body.agent_id));
  printField("amount_cents", stringish(body.amount_cents));
  printField("settled_at", stringish(body.settled_at));
  printField("error", stringish(body.error));
}

function printField(name: string, value: string | undefined): void {
  if (value === undefined) return;
  process.stdout.write(`${name}: ${value}\n`);
}

function printSecretField(ctx: CommandContext, name: string, value: string | undefined): void {
  if (value === undefined) return;
  printField(name, ctx.showSecrets ? value : "[saved/redacted]");
}

function redact(value: unknown, showSecrets: boolean): unknown {
  if (showSecrets) return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, showSecrets));
  if (!isObject(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      SECRET_KEYS.has(key) ? "[redacted]" : redact(entry, showSecrets),
    ]),
  );
}

function asJson(value: unknown): JsonObject {
  return isObject(value) ? value : {};
}

function stringish(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}
