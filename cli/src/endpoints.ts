export const DEFAULT_API_BASE_URL = "http://localhost:3000";

export const ENDPOINTS = {
  agentAccessRequests: "/api/agent-access/requests",
  agentAccessRequest: (requestId: string) => `/api/agent-access/requests/${encodeURIComponent(requestId)}`,
  agentAuth: "/api/auth/agent",
  transactionRequest: "/api/transactions/request",
  tokenVerify: "/api/tokens/verify",
} as const;
