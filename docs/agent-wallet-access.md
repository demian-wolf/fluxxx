# Agent Wallet Access

FLUX gives AI agents spending authority only through a human-managed wallet. The human operator owns and funds the `AgentWallet`, reviews access requests, and grants or denies an `AgentIdentity` with bounded spend policy. Agents must not self-provision wallet authority.

## Flow

1. Agent requests human authorization with purpose, spend limits, allowed domains, and expiry.
2. Human reviews the request in FLUX and approves, denies, or lets it expire.
3. On approval, FLUX issues or reveals a one-time agent API key for the approved `AgentIdentity`.
4. Agent exchanges that key at `POST /api/auth/agent` for a short-lived session token.
5. Agent requests wallet-backed spend at `POST /api/transactions/request`.
6. The KYA Policy Engine approves with a short-lived payment token or rejects with a reason code.

## Environment

```env
FLUX_API_BASE_URL=http://localhost:3000
FLUX_WALLET_ID=
FLUX_AGENT_ACCESS_REQUEST_ID=
FLUX_AGENT_ACCESS_REQUEST_CODE=
FLUX_AGENT_ACCESS_STATUS_URL=
FLUX_AGENT_API_KEY=
FLUX_SESSION_TOKEN=
FLUX_AGENT_CONFIG=
```

Store agent keys and session tokens outside the repository. Do not commit `.env` files containing real wallet authority.

## CLI Contract

Target CLI behavior. The first-party package currently uses the `flux-agent` command.

```bash
flux-agent request-access \
  --wallet-id "$FLUX_WALLET_ID" \
  --agent-name "Codex Worker C" \
  --purpose "Unlock a paywalled dataset for the current task" \
  --scope wallet:spend \
  --per-tx-limit-cents 50 \
  --hourly-limit-cents 200 \
  --daily-limit-cents 500 \
  --allowed-domain example.com \
  --expires-in-seconds 3600 \
  --metadata-json '{"payee_url":"https://example.com/api/unlock"}' \
  --json
```

```bash
flux-agent wait-access --request-id "$FLUX_AGENT_ACCESS_REQUEST_ID" \
  --request-code "$FLUX_AGENT_ACCESS_REQUEST_CODE" \
  --login \
  --json
```

```bash
flux-agent login --agent-api-key "$FLUX_AGENT_API_KEY" --json
```

```bash
flux-agent spend request \
  --amount-cents 50 \
  --payee-url "https://example.com/api/unlock" \
  --description "Unlock dataset needed for the approved task" \
  --json
```

All commands support `--json`. Human-readable output redacts high-value secrets by default unless `--show-secrets` is explicitly used. JSON output is intended for agent workflows and can contain the one-time credential returned by an approved poll.

## API Contract

### Request wallet access

Current backend endpoint:

```http
POST /api/agent-access/requests
Content-Type: application/json
```

```json
{
  "wallet_id": "wallet-uuid-or-invite-target",
  "agent_name": "Codex Worker C",
  "requested_scopes": ["wallet:spend"],
  "metadata": {
    "purpose": "Unlock a paywalled dataset for the current task",
    "payee_url": "https://example.com/api/unlock"
  },
  "limits": {
    "per_tx_limit_cents": 50,
    "hourly_limit_cents": 200,
    "daily_limit_cents": 500,
    "allowed_domains": ["example.com"]
  },
  "expires_in_seconds": 3600
}
```

Expected response:

```json
{
  "request_id": "uuid",
  "request_code": "one-time-status-code",
  "wallet_id": "wallet-uuid",
  "agent_name": "Codex Worker C",
  "limits": {
    "per_tx_limit_cents": 50,
    "hourly_limit_cents": 200,
    "daily_limit_cents": 500,
    "allowed_domains": ["example.com"]
  },
  "status": "pending",
  "authorize_url": "http://localhost:5173/agent-access/authorize?request_id=uuid&code=AGT-1234",
  "status_url": "http://localhost:3000/api/agent-access/requests/uuid?request_code=AGT-1234"
}
```

`request_code` or an equivalent claim secret is required so the approved agent API key is not retrievable by request ID alone.

### Check access status

Current backend endpoint:

```http
GET /api/agent-access/requests/:request_id?request_code=<request_code>
```

Pending response:

```json
{
  "request_id": "uuid",
  "request_code": "one-time-status-code",
  "status": "pending",
  "api_key": null,
  "api_key_available": false
}
```

Approved response:

```json
{
  "request_id": "uuid",
  "request_code": "one-time-status-code",
  "status": "approved",
  "agent_id": "uuid",
  "wallet_id": "uuid",
  "api_key": "flux_sk_live_xxxx",
  "api_key_available": true,
  "limits": {
    "per_tx_limit_cents": 50,
    "hourly_limit_cents": 200,
    "daily_limit_cents": 500
  }
}
```

Denied response:

```json
{
  "request_id": "uuid",
  "status": "denied",
  "status_reason": "human_denied"
}
```

### Authenticate approved agent

Implemented endpoint:

```http
POST /api/auth/agent
Content-Type: application/json
```

```bash
curl -sS -X POST "$FLUX_API_BASE_URL/api/auth/agent" \
  -H "Content-Type: application/json" \
  -d '{"agent_api_key":"'"$FLUX_AGENT_API_KEY"'"}'
```

Response:

```json
{
  "agent_id": "uuid",
  "wallet_id": "uuid",
  "session_token": "eyJhbGci...",
  "expires_in": 86400,
  "balance_cents": 1995,
  "status": "active"
}
```

### Request spend

Implemented endpoint:

```http
POST /api/transactions/request
Authorization: Bearer <agent_session_token>
Content-Type: application/json
```

```bash
curl -sS -X POST "$FLUX_API_BASE_URL/api/transactions/request" \
  -H "Authorization: Bearer $FLUX_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount_cents": 50,
    "payee_url": "https://example.com/api/unlock",
    "description": "Unlock dataset needed for the approved task"
  }'
```

Approved response:

```json
{
  "decision": "approved",
  "payment_token": "flux_tok_7f3a...",
  "token_expires_at": "2026-06-21T14:32:05Z",
  "balance_after_cents": 1945,
  "transaction_id": "uuid"
}
```

Rejected response:

```json
{
  "decision": "rejected",
  "rejection_reason": "hourly_limit_exceeded",
  "retry_after_seconds": 3600
}
```

## Rejection Handling

Access request statuses:

- `pending`: keep waiting with gentle polling.
- `approved`: authenticate and continue inside the approved policy.
- `denied`: stop and report `status_reason`.
- `expired`: stop; submit a narrower new request only if the task still requires wallet access.

Transaction rejection reasons currently expected from the KYA Policy Engine:

- `agent_suspended`
- `per_tx_limit_exceeded`
- `hourly_limit_exceeded`
- `daily_limit_exceeded`
- `insufficient_balance`
- `domain_blocked`
- `missing_description`

Do not try to bypass these controls. Ask the human for an updated grant only when the task still justifies it.

## Human Operator Review

Human review endpoints require a human operator JWT:

```http
GET /api/agent-access/operator/requests
POST /api/agent-access/operator/requests/:request_id/approve
POST /api/agent-access/operator/requests/:request_id/deny
```

Approving creates an `AgentIdentity` and stages the raw key for a one-time CLI poll. Denying records `status_reason` and does not issue wallet authority.

## Security Expectations

- The human owns the wallet, deposits funds, and grants or denies access.
- Agents receive only scoped `AgentIdentity` authority, never human account authority.
- The backend stores hashes of agent API keys; raw keys are one-time secrets.
- Session tokens and payment tokens are short-lived and must not be logged.
- Payment tokens should be used only for the payee/resource named in the approved transaction.
- Access status endpoints must require a one-time request code or claim token before returning credentials.

## CLI And API Contract

Current backend routes include `POST /api/agent-access/requests`, `GET /api/agent-access/requests/:request_id?request_code=...`, `POST /api/auth/agent`, and `POST /api/transactions/request`.

- access request body: `wallet_id`, `agent_name`, optional `requested_scopes`, `metadata`, `limits`, and `expires_in_seconds`.
- status route path: `GET /api/agent-access/requests/:request_id?request_code=<request_code>`.
- claim field: `request_code`; the CLI persists it or accepts `--request-code`.
- approved credential field: backend returns `api_key`; CLI stores it locally as the agent API key when saving is enabled.
- CLI verbs: `request-access`, `wait-access`, `login`, `spend request`.
