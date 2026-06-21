import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import type { AgentAuthResponse, AgentSessionRecord, FluxAgentConfig, JsonObject } from "./types";

const CONFIG_VERSION = 1;

export function defaultConfigPath(): string {
  const envPath = process.env.FLUX_AGENT_CONFIG;
  if (envPath) return resolve(envPath);

  const configHome = process.env.XDG_CONFIG_HOME;
  if (configHome) return join(configHome, "flux-agent", "config.json");

  return join(homedir(), ".config", "flux-agent", "config.json");
}

export async function readConfig(configPath: string): Promise<FluxAgentConfig> {
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) return emptyConfig();
    return { ...emptyConfig(), ...parsed, version: CONFIG_VERSION };
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return emptyConfig();
    throw error;
  }
}

export async function writeConfig(configPath: string, config: FluxAgentConfig): Promise<void> {
  await mkdir(dirname(configPath), { recursive: true, mode: 0o700 });
  await writeFile(configPath, `${JSON.stringify({ ...config, version: CONFIG_VERSION }, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(configPath, 0o600);
}

export async function writeJsonOutput(outputPath: string, data: unknown): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true, mode: 0o700 });
  await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(outputPath, 0o600);
}

export function withRequestUpdate(
  config: FluxAgentConfig,
  requestId: string,
  response: JsonObject,
  apiBaseUrl: string,
): FluxAgentConfig {
  const existingRequests = config.requests ?? {};
  const existing = existingRequests[requestId];
  const status = stringField(response, "status") ?? existing?.status;
  const approvalUrl = stringField(response, "approval_url") ?? stringField(response, "approvalUrl") ?? existing?.approvalUrl;
  const statusUrl = stringField(response, "status_url") ?? stringField(response, "statusUrl") ?? existing?.statusUrl;
  const requestCode = stringField(response, "request_code") ?? stringField(response, "requestCode") ?? existing?.requestCode;
  const agentId = stringField(response, "agent_id") ?? stringField(response, "agentId") ?? existing?.agentId;
  const walletId = stringField(response, "wallet_id") ?? stringField(response, "walletId") ?? existing?.walletId;

  return {
    ...config,
    apiBaseUrl,
    lastRequestId: requestId,
    requests: {
      ...existingRequests,
      [requestId]: {
        requestId,
        requestCode,
        status,
        approvalUrl,
        statusUrl,
        agentId,
        walletId,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  };
}

export function withAgentApiKey(config: FluxAgentConfig, agentApiKey: string | undefined): FluxAgentConfig {
  if (!agentApiKey) return config;
  return { ...config, agentApiKey };
}

export function withSession(config: FluxAgentConfig, response: AgentAuthResponse): FluxAgentConfig {
  if (!response.session_token) return config;

  const session: AgentSessionRecord = {
    token: response.session_token,
    agentId: response.agent_id,
    walletId: response.wallet_id,
    expiresIn: response.expires_in,
    expiresAt: response.expires_in === undefined ? undefined : new Date(Date.now() + response.expires_in * 1000).toISOString(),
    balanceCents: response.balance_cents,
    status: response.status,
  };

  return { ...config, session };
}

export function stringField(data: JsonObject, snakeName: string): string | undefined {
  const value = data[snakeName];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function numberField(data: JsonObject, snakeName: string): number | undefined {
  const value = data[snakeName];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function emptyConfig(): FluxAgentConfig {
  return { version: CONFIG_VERSION };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return !!error && typeof error === "object" && "code" in error;
}
