export type JsonObject = Record<string, unknown>;

export interface AgentAccessRequestRecord {
  requestId: string;
  requestCode?: string;
  status?: string;
  approvalUrl?: string;
  statusUrl?: string;
  agentId?: string;
  walletId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentSessionRecord {
  token: string;
  agentId?: string;
  walletId?: string;
  expiresIn?: number;
  expiresAt?: string;
  balanceCents?: number | null;
  status?: string;
}

export interface FluxAgentConfig {
  version: 1;
  apiBaseUrl?: string;
  lastRequestId?: string;
  agentApiKey?: string;
  requests?: Record<string, AgentAccessRequestRecord>;
  session?: AgentSessionRecord;
}

export interface CommandContext {
  apiBaseUrl: string;
  configPath: string;
  config: FluxAgentConfig;
  json: boolean;
  save: boolean;
  showSecrets: boolean;
  outputPath?: string;
}

export interface AgentAuthResponse {
  agent_id?: string;
  wallet_id?: string;
  session_token?: string;
  expires_in?: number;
  balance_cents?: number | null;
  status?: string;
}

export interface CommandResult {
  ok: boolean;
  command: string;
  apiBaseUrl: string;
  saved: boolean;
  configPath: string;
  data: unknown;
}
