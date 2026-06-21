# FLUX — Backend Architecture
**Agentic Commerce Gateway · Built on Base44 + Mollie**

---

## Overview

FLUX is a programmable micro-transaction middleware that gives AI agents verifiable identities and strict, human-governed purchasing power. It sits between an AI agent and the open economy, acting as the policy engine, identity registry, and payment rail.

```
Human User
    │
    ▼
[Mollie Onramp] ──► [Agent Wallet / Virtual Ledger]
                              │
                    [KYA Policy Engine]
                              │
                    AI Agent ──► HTTP 402 ──► FLUX ──► Token Issued ──► Unlocked Resource
```

---

## Platform: Base44

Base44 provides the runtime for FLUX's backend:

- **Database**: Built-in entity store (acts as the virtual ledger and KYA registry)
- **Auth**: Built-in user authentication for the human operator
- **Business Logic**: Custom functions / action blocks for the policy engine
- **APIs**: Auto-generated REST endpoints per entity + custom action endpoints
- **Webhooks**: Receive Mollie payment events

---

## 1. Data Models (Base44 Entities)

### 1.1 `User` (Human Operator)
The human who funds the agent wallet and sets spend policies.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `email` | String | Unique, used for auth |
| `full_name` | String | Display name |
| `mollie_customer_id` | String | Mollie customer reference |
| `created_at` | DateTime | |

---

### 1.2 `AgentWallet`
The funded virtual account that backs one or more agents. Funded via Mollie.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `owner_id` | UUID | FK → User |
| `name` | String | e.g. "Research Budget Q3" |
| `balance_cents` | Integer | Current balance in euro cents (e.g. 2000 = €20.00) |
| `status` | Enum | `active` \| `suspended` \| `depleted` |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

> **Immutability rule**: Balance is never edited directly. It is always derived from the append-only `LedgerEntry` log. The `balance_cents` field is a cached projection, recalculated on each transaction.

---

### 1.3 `AgentIdentity` (KYA Registry)
Each registered AI agent. This is the "Know Your Agent" record.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `wallet_id` | UUID | FK → AgentWallet |
| `owner_id` | UUID | FK → User |
| `parent_id` | UUID \| null | Self-FK → AgentIdentity. Parent in the agent spend tree; null = root agent. `ON DELETE CASCADE` tears down the whole subtree. |
| `name` | String | Human-readable label, e.g. "ResearchBot v2" |
| `api_key_hash` | String | SHA-256 hash of the agent's secret API key (never stored in plain text) |
| `status` | Enum | `active` \| `suspended` \| `revoked` |
| `hourly_limit_cents` | Integer | Max spend per rolling 60-minute window |
| `per_tx_limit_cents` | Integer | Max spend per single transaction |
| `daily_limit_cents` | Integer | Max spend per calendar day |
| `allowed_domains` | String[] | Optional whitelist of payee domains |
| `created_at` | DateTime | |
| `last_seen_at` | DateTime | Updated on each successful auth |

---

### 1.3a `AgentAccessRequest`
External CLI/agent requests for access to a human-managed wallet. The operator approves or denies the request; approval creates an `AgentIdentity`.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key and polling identifier |
| `wallet_id` | UUID | FK → AgentWallet |
| `owner_id` | UUID | FK → User/operator who owns the wallet |
| `request_code` | String | Short human-readable code returned to the CLI |
| `agent_name` | String | Requested agent display name |
| `requested_scopes` | String[] | Optional requested access labels |
| `requested_metadata` | JSON | CLI/agent metadata, e.g. command, host, purpose |
| `hourly_limit_cents` | Integer \| null | Requested spend limit |
| `per_tx_limit_cents` | Integer \| null | Requested spend limit |
| `daily_limit_cents` | Integer \| null | Requested spend limit |
| `allowed_domains` | String[] \| null | Requested payee domain allowlist |
| `blocked_domains` | String[] \| null | Requested payee domain blocklist |
| `status` | Enum | `pending` \| `approved` \| `denied` \| `expired` |
| `agent_id` | UUID \| null | Created on approval |
| `agent_api_key_once` | String \| null | Raw key staged only until first successful CLI poll |
| `api_key_delivered_at` | DateTime \| null | Set when the staged key is consumed |
| `expires_at` | DateTime | Pending request expiry |
| `approved_at` / `denied_at` | DateTime \| null | Review timestamps |

---

### 1.4 `SpendPolicy`
Versioned policy rules attached to an agent. Evaluated by the policy engine on every transaction.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `agent_id` | UUID | FK → AgentIdentity |
| `version` | Integer | Monotonically increasing |
| `rules` | JSON | Structured rule set (see Policy Rule Schema below) |
| `is_active` | Boolean | Only one active policy per agent at a time |
| `created_by` | UUID | FK → User |
| `created_at` | DateTime | |

**Policy Rule Schema (JSON)**
```json
{
  "hourly_limit_cents": 200,
  "per_tx_limit_cents": 10,
  "daily_limit_cents": 1000,
  "allowed_categories": ["data", "api_access", "compute"],
  "blocked_domains": ["gambling.com"],
  "require_description": true,
  "auto_suspend_on_anomaly": true
}
```

---

### 1.5 `LedgerEntry`
Append-only financial log. Every balance change is recorded here. Never deleted or updated.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `wallet_id` | UUID | FK → AgentWallet |
| `agent_id` | UUID \| null | FK → AgentIdentity (null for deposits) |
| `type` | Enum | `deposit` \| `spend` \| `refund` \| `hold` \| `release` |
| `amount_cents` | Integer | Positive always; direction determined by `type` |
| `balance_after_cents` | Integer | Snapshot of wallet balance after this entry |
| `description` | String | Human-readable reason |
| `payee_url` | String \| null | The URL the agent was paying for |
| `mollie_payment_id` | String \| null | Mollie reference for deposits |
| `payment_token` | String \| null | UUID token issued to agent on approval |
| `status` | Enum | `pending` \| `settled` \| `failed` \| `reversed` |
| `metadata` | JSON | Arbitrary extra data (agent request headers, etc.) |
| `created_at` | DateTime | Immutable timestamp |

---

### 1.6 `MolliePayment`
Tracks Mollie deposit sessions initiated by the human operator.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → User |
| `wallet_id` | UUID | FK → AgentWallet |
| `mollie_payment_id` | String | Mollie's own ID (e.g. `tr_abc123`) |
| `amount_cents` | Integer | Amount in euro cents |
| `method` | String | `ideal` \| `creditcard` \| `banktransfer` |
| `status` | Enum | `open` \| `pending` \| `paid` \| `failed` \| `expired` |
| `checkout_url` | String | Mollie hosted checkout link |
| `webhook_received_at` | DateTime \| null | When Mollie confirmed payment |
| `created_at` | DateTime | |

---

### 1.7 `TransactionRequest`
Every request an agent makes to FLUX before approval or rejection. The policy engine evaluates this.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `agent_id` | UUID | FK → AgentIdentity |
| `wallet_id` | UUID | FK → AgentWallet |
| `requested_amount_cents` | Integer | Amount the agent is requesting |
| `payee_url` | String | The URL/resource behind the paywall |
| `description` | String | Agent-supplied reason |
| `decision` | Enum | `pending` \| `approved` \| `rejected` |
| `rejection_reason` | String \| null | E.g. "hourly_limit_exceeded" |
| `payment_token` | String \| null | Issued only on approval (UUID, single-use) |
| `token_expires_at` | DateTime \| null | Token TTL (default: 30 seconds) |
| `ledger_entry_id` | UUID \| null | FK → LedgerEntry (created on approval) |
| `created_at` | DateTime | |

---

## 2. API Endpoints

Base44 auto-generates CRUD endpoints for every entity. Below are the **custom action endpoints** that form the core of FLUX's logic.

### 2.1 Agent Authentication
```
POST /api/auth/agent
```
**Purpose**: Agent presents its API key. FLUX validates and returns a short-lived JWT.

**Request**
```json
{
  "agent_api_key": "flux_sk_live_xxxx"
}
```

**Response (200)**
```json
{
  "agent_id": "uuid",
  "wallet_id": "uuid",
  "session_token": "eyJhbGci...",
  "expires_in": 3600,
  "balance_cents": 1995,
  "status": "active"
}
```

**Response (401)**
```json
{ "error": "invalid_agent_key" }
```

---

### 2.1a Agent Wallet Access Request
```
POST /api/agent-access/requests
```
**Purpose**: An external CLI/agent asks the human wallet owner for bounded wallet access.

**Request**
```json
{
  "wallet_id": "uuid",
  "agent_name": "Codex Worker",
  "requested_scopes": ["wallet:spend"],
  "metadata": { "purpose": "Unlock required research data" },
  "limits": {
    "per_tx_limit_cents": 50,
    "hourly_limit_cents": 200,
    "daily_limit_cents": 500,
    "allowed_domains": ["example.com"],
    "blocked_domains": []
  },
  "expires_in_seconds": 3600
}
```

**Response (201)**
```json
{
  "request_id": "uuid",
  "request_code": "AGT-ABCD1234",
  "status": "pending",
  "authorize_url": "http://localhost:5173/agent-access/authorize?request_id=uuid&code=AGT-ABCD1234",
  "status_url": "http://localhost:3000/api/agent-access/requests/uuid?request_code=AGT-ABCD1234"
}
```

```
GET /api/agent-access/requests/{request_id}?request_code=<request_code>
```
**Purpose**: The requesting agent polls for approval. If approved, the raw API key is returned once and immediately cleared from the request row.

```
GET /api/agent-access/operator/requests
POST /api/agent-access/operator/requests/{request_id}/approve
POST /api/agent-access/operator/requests/{request_id}/deny
Authorization: Bearer <user_jwt>
```
**Purpose**: The human operator reviews pending access requests. Approval creates an `AgentIdentity` and active `SpendPolicy`; denial records `status_reason`.

> Production hardening: the current implementation temporarily stores `agent_api_key_once` in the database for a single CLI poll. Encrypt this value or replace it with a stronger out-of-band delivery channel before a production deployment.

### 2.2 Transaction Request (Core HTTP 402 Flow)
```
POST /api/transactions/request
Authorization: Bearer <agent_session_token>
```
**Purpose**: Agent hits a paywall and asks FLUX to approve and fund the transaction.

**Request**
```json
{
  "amount_cents": 5,
  "payee_url": "https://dataset-provider.com/api/unlock",
  "description": "Unlock climate dataset chunk #42",
  "category": "data"
}
```

**Policy Engine Evaluation (internal)**
1. Verify agent JWT is valid and `status = active`
2. Load active `SpendPolicy` for this agent
3. Check `per_tx_limit_cents` ≥ requested amount
4. Check rolling 60-min spend ≤ `hourly_limit_cents`
5. Check rolling 24-hr spend ≤ `daily_limit_cents`
6. Check wallet `balance_cents` ≥ requested amount
7. Check `payee_url` domain not in `blocked_domains`
8. If all pass → `approved`; else → `rejected` with reason code

**Response (200 — Approved)**
```json
{
  "decision": "approved",
  "payment_token": "flux_tok_7f3a...",
  "token_expires_at": "2025-06-20T14:32:05Z",
  "balance_after_cents": 1990,
  "transaction_id": "uuid"
}
```

**Response (402 — Rejected)**
```json
{
  "decision": "rejected",
  "rejection_reason": "hourly_limit_exceeded",
  "hourly_spent_cents": 198,
  "hourly_limit_cents": 200,
  "retry_after_seconds": 312
}
```

---

### 2.3 Token Verification (for Payee Providers)
```
POST /api/tokens/verify
X-FLUX-Provider-Key: <provider_api_key>
```
**Purpose**: A data provider (the paywall) calls FLUX to verify a payment token is genuine before releasing content.

**Request**
```json
{
  "payment_token": "flux_tok_7f3a...",
  "expected_amount_cents": 5
}
```

**Response (200)**
```json
{
  "valid": true,
  "agent_id": "uuid",
  "amount_cents": 5,
  "settled_at": "2025-06-20T14:32:04Z"
}
```

---

### 2.4 Mollie Deposit — Create Checkout
```
POST /api/payments/deposit
Authorization: Bearer <user_jwt>
```
**Purpose**: Human operator initiates a wallet top-up via Mollie.

**Request**
```json
{
  "wallet_id": "uuid",
  "amount_cents": 2000,
  "method": "ideal"
}
```

**Base44 Logic**
1. Call Mollie API: `POST /v2/payments` with amount, description, webhookUrl, redirectUrl
2. Store `MolliePayment` record with `status: open`
3. Return Mollie checkout URL to frontend

**Response**
```json
{
  "mollie_payment_id": "tr_abc123",
  "checkout_url": "https://www.mollie.com/checkout/...",
  "expires_at": "2025-06-20T15:00:00Z"
}
```

---

### 2.5 Mollie Webhook (Payment Confirmation)
```
POST /api/webhooks/mollie
```
**Purpose**: Mollie calls this when payment status changes (e.g., user completes iDEAL payment).

**Base44 Logic**
1. Receive `id` (Mollie payment ID) from webhook body
2. Fetch payment from Mollie: `GET /v2/payments/{id}`
3. If `status = paid`:
   - Update `MolliePayment.status → paid`
   - Create `LedgerEntry` with `type: deposit`
   - Update `AgentWallet.balance_cents += amount_cents`
4. If `status = failed/expired`:
   - Update `MolliePayment.status` accordingly
   - No ledger entry created

---

### 2.6 Agent Registration
```
POST /api/agents/register
Authorization: Bearer <user_jwt>
```
**Purpose**: Human operator creates a new agent identity and receives the API key (shown once).

**Request**
```json
{
  "wallet_id": "uuid",
  "name": "ResearchBot v1",
  "hourly_limit_cents": 200,
  "per_tx_limit_cents": 10,
  "daily_limit_cents": 1000
}
```

**Response**
```json
{
  "agent_id": "uuid",
  "api_key": "flux_sk_live_xxxx",
  "warning": "Store this key securely. It will not be shown again."
}
```

---

### 2.7 Spend Analytics
```
GET /api/wallets/{wallet_id}/analytics
Authorization: Bearer <user_jwt>
```
**Response**
```json
{
  "wallet_id": "uuid",
  "balance_cents": 1990,
  "total_deposited_cents": 2000,
  "total_spent_cents": 10,
  "agents": [
    {
      "agent_id": "uuid",
      "name": "ResearchBot v1",
      "spent_last_hour_cents": 5,
      "spent_today_cents": 10,
      "transaction_count": 2,
      "last_tx_at": "2025-06-20T14:32:04Z"
    }
  ],
  "recent_transactions": []
}
```

---

## 3. KYA Policy Engine — State Machine

```
Agent Request
     │
     ▼
[Authenticate Agent] ──FAIL──► 401 Unauthorized
     │
   PASS
     │
     ▼
[Load Active SpendPolicy]
     │
     ▼
[Check per_tx_limit] ──FAIL──► 402 { rejection_reason: "per_tx_limit_exceeded" }
     │
   PASS
     │
     ▼
[Check hourly rolling window] ──FAIL──► 402 { rejection_reason: "hourly_limit_exceeded", retry_after_seconds: N }
     │
   PASS
     │
     ▼
[Check daily rolling window] ──FAIL──► 402 { rejection_reason: "daily_limit_exceeded" }
     │
   PASS
     │
     ▼
[Check wallet balance] ──FAIL──► 402 { rejection_reason: "insufficient_balance" }
     │
   PASS
     │
     ▼
[Check domain allowlist/blocklist] ──FAIL──► 402 { rejection_reason: "domain_blocked" }
     │
   PASS
     │
     ▼
[Atomic: Deduct balance + Write LedgerEntry + Issue Token]
     │
     ▼
200 Approved { payment_token, balance_after_cents }
```

---

## 4. Mollie Integration Details

### Keys Required (Base44 Environment Variables)
```
MOLLIE_API_KEY=live_xxxxxxxxxxxxxxxxxxxx
MOLLIE_WEBHOOK_URL=https://your-app.base44.app/api/webhooks/mollie
MOLLIE_REDIRECT_URL=https://your-app.base44.app/wallet/deposit/success
```

### Supported Payment Methods
| Method | Countries | Settlement |
|---|---|---|
| iDEAL | Netherlands | Near-instant |
| Credit Card (Visa/MC) | EU-wide | ~1 day |
| Bancontact | Belgium | Near-instant |
| SEPA Bank Transfer | EU-wide | 1-2 days |

### Idempotency
Each deposit request generates a unique `idempotency_key` (UUID) sent in the Mollie API call header to prevent double-processing on webhook retries.

---

## 5. Security Model

| Concern | Mitigation |
|---|---|
| Agent API key exposure | Keys are SHA-256 hashed before storage; raw key shown only once at creation |
| Webhook spoofing | All webhooks re-verified by fetching the payment directly from Mollie API |
| Token replay attacks | Payment tokens are single-use, expire in 30 seconds, and are invalidated immediately after first verification |
| Balance manipulation | Balance is only mutated through the atomic ledger write + projection pattern; direct field edits are blocked |
| Over-spend | Policy engine evaluates limits atomically before any deduction |
| Agent identity theft | Session tokens are short-lived (1 hour) JWTs; agents must re-authenticate regularly |

---

## 6. Database Schema Summary

```
User ──────────────┐
                   │ owns
                   ▼
             AgentWallet ◄────── MolliePayment
                   │                   (Mollie deposit sessions)
                   │ has many
                   ▼
             LedgerEntry          (immutable append-only log)
                   │
             AgentIdentity ◄───── SpendPolicy (versioned rules)
                   │
             TransactionRequest   (every agent payment attempt)
```

---

## 7. Environment Variables (Base44 Config)

```env
# Mollie
MOLLIE_API_KEY=live_xxxx
MOLLIE_WEBHOOK_SECRET=whsec_xxxx

# FLUX Internal
FLUX_TOKEN_TTL_SECONDS=30
FLUX_SESSION_TTL_SECONDS=3600
FLUX_PROVIDER_API_KEY=provider_xxxx   # For paywall providers calling /tokens/verify

# Base44
BASE44_APP_URL=https://your-flux-app.base44.app
```

---

*Document version 1.0 — FLUX Megathon Build*
