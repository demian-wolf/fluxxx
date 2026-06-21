# FLUX Agent CLI

`flux-agent` is the first-party CLI for agents that need human-approved access to a FLUX managed wallet.

The CLI defaults to `FLUX_API_BASE_URL`, then saved config, then `http://localhost:3000`. It writes local state to `FLUX_AGENT_CONFIG` or `~/.config/flux-agent/config.json` with `0600` file permissions. Use `--config <path>` for an explicit config file, `--no-save` to avoid writing secrets, and `--output <path>` to write command JSON to a `0600` file.

## Commands

```bash
flux-agent request-access \
  --wallet-id wallet_research01 \
  --agent-name "research-agent" \
  --purpose "Pay approved paywalled research sources" \
  --scope payments:spend \
  --per-tx-limit-cents 500 \
  --daily-limit-cents 2500 \
  --json
```

Creates `POST /api/agent-access/requests` and saves the returned `request_id` and `request_code` if present.

```bash
flux-agent wait-access --request-id <request_id> --request-code <request_code> --login --json
```

Polls `GET /api/agent-access/requests/:id` with `X-FLUX-Request-Code`. If approval returns an `api_key`, it is saved. With `--login`, the CLI exchanges that key with `POST /api/auth/agent` and stores the returned session token.

```bash
flux-agent login --agent-api-key "$FLUX_AGENT_API_KEY" --json
```

Exchanges an agent API key for an agent session token using `POST /api/auth/agent`.

```bash
flux-agent spend request \
  --amount-cents 199 \
  --payee-url "https://provider.example/article/123" \
  --description "Article access" \
  --json
```

Calls `POST /api/transactions/request` with the saved session token, `FLUX_SESSION_TOKEN`, or `--session-token`.

```bash
flux-agent verify-provider-token \
  --payment-token "$PAYMENT_TOKEN" \
  --provider-key "$FLUX_PROVIDER_API_KEY" \
  --expected-amount-cents 199 \
  --json
```

Provider helper for `POST /api/tokens/verify`. Provider keys are never saved by the CLI.

## Backend Contract Assumptions

The pending human-access API is expected to expose:

- `POST /api/agent-access/requests`
- `GET /api/agent-access/requests/:id`
- `POST /api/auth/agent`
- `POST /api/transactions/request`

The access request response should include `request_id`, `request_code`, `approval_url`, and `status_url`. Approved status responses may include `api_key`, plus optional `agent_id`, `wallet_id`, and `session_token`. Endpoint paths are centralized in `src/endpoints.ts`.
