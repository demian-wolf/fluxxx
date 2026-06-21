---
name: flux-agent-wallet
description: Request human authorization for a FLUX human-managed AgentWallet, authenticate as an approved AgentIdentity, and request wallet-backed spend with JSON CLI or API calls. Use when any AI agent needs permissioned wallet access, HTTP 402 payment approval, agent access request polling, or safe handling of FLUX agent API keys/session tokens.
---

# FLUX Agent Wallet

Use this skill when an agent needs spending authority through FLUX. FLUX wallets are owned and funded by a human operator. The agent must request access, wait for the human to approve or deny it, then operate only inside the approved limits.

## Hard Rules

- Do not self-provision wallet authority. Do not call human-only registration endpoints with a human token unless the human explicitly directs that in the current task.
- Do not ask for or expose human passwords, Mollie credentials, user JWTs, provider API keys, raw agent API keys, session tokens, or payment tokens in chat, logs, commits, docs, screenshots, or final answers.
- Use least authority: request the smallest amount, shortest duration, narrowest domain list, and clearest purpose that satisfies the task.
- Use JSON output from the CLI or API. Parse fields from structured JSON instead of scraping human text.
- Treat rejection as a decision, not an error to bypass. Stop or ask the human for a revised grant.

## Environment

Prefer the FLUX CLI when available. Use API calls only when the CLI is not installed in the agent runtime.

Required or commonly used variables:

```bash
FLUX_API_BASE_URL=http://localhost:3000
FLUX_WALLET_ID=<human-managed wallet id or invite-provided wallet target>
FLUX_AGENT_ACCESS_REQUEST_ID=<request id returned by access request>
FLUX_AGENT_ACCESS_REQUEST_CODE=<request_code or one-time status claim returned by access request>
FLUX_AGENT_ACCESS_STATUS_URL=<status_url returned by access request>
FLUX_AGENT_API_KEY=<approved agent key, stored outside project files>
FLUX_SESSION_TOKEN=<short-lived token from POST /api/auth/agent>
```

The first-party CLI is `flux-agent`. It also accepts skill-style aliases such as `agent-access request`, `agent-access status`, and `transaction request`.

## Workflow

### 1. Prepare the authorization request

Include enough context for a human operator to make a decision:

- agent name and runtime, for example `Codex Worker C`
- purpose, payee/resource, and expected result
- requested wallet if known
- `per_tx_limit_cents`, `hourly_limit_cents`, `daily_limit_cents`
- allowed domains or payee URLs
- expiry or expected task duration

### 2. Request human authorization

Use the CLI with JSON output when present:

```bash
flux-agent request-access \
  --wallet-id "$FLUX_WALLET_ID" \
  --agent-name "$AGENT_NAME" \
  --purpose "$PURPOSE" \
  --scope wallet:spend \
  --per-tx-limit-cents 50 \
  --hourly-limit-cents 200 \
  --daily-limit-cents 500 \
  --allowed-domain example.com \
  --expires-in-seconds 3600 \
  --metadata-json '{"payee_url":"https://example.com/api/unlock"}' \
  --json
```

Fallback API contract:

```bash
curl -sS -X POST "$FLUX_API_BASE_URL/api/agent-access/requests" \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_id": "'"$FLUX_WALLET_ID"'",
    "agent_name": "Codex Worker C",
    "requested_scopes": ["wallet:spend"],
    "metadata": {
      "purpose": "Unlock a required dataset for the current task",
      "payee_url": "https://example.com/api/unlock"
    },
    "limits": {
      "per_tx_limit_cents": 50,
      "hourly_limit_cents": 200,
      "daily_limit_cents": 500,
      "allowed_domains": ["example.com"]
    },
    "expires_in_seconds": 3600
  }'
```

Expected response shape:

```json
{
  "request_id": "uuid",
  "request_code": "one-time-status-code",
  "status": "pending",
  "authorize_url": "http://localhost:5173/agent-access/authorize?request_id=uuid&code=AGT-1234",
  "status_url": "http://localhost:3000/api/agent-access/requests/uuid?request_code=AGT-1234"
}
```

Store `request_id`, `request_code`, and `status_url` in memory or environment only. Treat `request_code` as a secret claim. A bare request ID must not be enough to retrieve credentials.

### 3. Wait for the human decision

Poll gently. Do not spin or retry aggressively.

```bash
flux-agent wait-access --request-id "$FLUX_AGENT_ACCESS_REQUEST_ID" \
  --request-code "$FLUX_AGENT_ACCESS_REQUEST_CODE" \
  --login \
  --json
```

Fallback API contract:

```bash
curl -sS "$FLUX_API_BASE_URL/api/agent-access/requests/$FLUX_AGENT_ACCESS_REQUEST_ID?request_code=$FLUX_AGENT_ACCESS_REQUEST_CODE"
```

Handle statuses:

- `pending`: wait and poll again later.
- `approved`: extract the one-time `api_key`, `agent_api_key`, or CLI-saved agent key; do not print it.
- `denied`: stop and report `status_reason`.
- `expired`: stop and submit a new narrower request only if the task still requires it.

### 4. Authenticate as the approved agent

```bash
curl -sS -X POST "$FLUX_API_BASE_URL/api/auth/agent" \
  -H "Content-Type: application/json" \
  -d '{"agent_api_key":"'"$FLUX_AGENT_API_KEY"'"}'
```

Expected fields: `agent_id`, `wallet_id`, `session_token`, `expires_in`, `balance_cents`, `status`.

Set `FLUX_SESSION_TOKEN` from `session_token`. Never persist it in the repo.

### 5. Request wallet-backed spend

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

On approval, FLUX returns a short-lived `payment_token`. Use it only with the intended payee/resource. Do not expose it in final output.

### 6. Handle denial and errors

- Access denial reasons such as `human_denied`, `limit_too_high`, `wallet_unavailable`, `domains_not_allowed`, or `expired`: stop and report the reason without retrying automatically.
- Transaction `402` reasons such as `agent_suspended`, `per_tx_limit_exceeded`, `hourly_limit_exceeded`, `daily_limit_exceeded`, `insufficient_balance`, `domain_blocked`, or `missing_description`: stop or ask for a narrower/updated grant.
- `401 missing_session_token` or `invalid_session_token`: re-authenticate once with the approved agent key. If that fails, request human help.
- `5xx` or network failures: retry with backoff only when the operation is idempotent or when no spend token was issued.

## Agent-Facing JSON Result

When reporting to another agent or workflow, emit structured JSON and redact secrets:

```json
{
  "status": "approved",
  "agent_id": "uuid",
  "wallet_id": "uuid",
  "transaction_id": "uuid",
  "amount_cents": 50,
  "payee_url": "https://example.com/api/unlock",
  "payment_token": "[redacted]"
}
```

For denied access or rejected spend:

```json
{
  "status": "rejected",
  "stage": "transaction_request",
  "reason": "domain_blocked",
  "retry_after_seconds": null
}
```

## Contract

This skill uses:

- `POST /api/agent-access/requests`
- `GET /api/agent-access/requests/:request_id?request_code=<request_code>` or an equivalent status route
- `POST /api/auth/agent`
- `POST /api/transactions/request`

The backend also exposes human-operator review endpoints under `/api/agent-access/operator/requests`. Operator approval creates the bounded `AgentIdentity`, stages the raw agent key for one successful CLI status poll, and records `api_key_delivered_at`.
