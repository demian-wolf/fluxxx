# FLUX — Frontend (Operator Command Center)

The human operator's command center for **FLUX**, an Agentic Commerce Gateway
that gives AI agents verifiable identities and strict, human-governed purchasing
power. This is the frontend that implements the
[`frontend-architecture`](#) blueprint and talks to the backend described in
[`backend-architecture.md`](./backend-architecture.md).

It is an infrastructure dashboard, not a consumer app: real-time visibility into
what your agents are spending, where, and why.

## Stack

- **React 18 + TypeScript + Vite**
- **Tailwind CSS** (dark, terminal-inspired theme)
- **React Router** for the route map below
- **Recharts** for spend charts
- **lucide-react** for icons

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173
```

Other scripts:

```bash
npm run build        # type-check + production build
npm run preview      # serve the production build
npm run lint         # eslint (zero-warning policy)
npm run typecheck    # tsc --noEmit
```

## Demo mode vs. live backend

By default the app runs in **demo mode** against a fully in-memory simulation of
the FLUX backend — no server required. A background simulation streams live
agent spend into the ledger so the dashboard feels real. Any email/password
signs you in.

To point at a real backend, copy `.env.example` to `.env` and set:

```env
VITE_USE_MOCK=false
VITE_API_BASE_URL=https://your-flux-app.base44.app
```

Both backends implement the same `FluxApi` interface (`src/api/types.ts`), so
screens never care which one is live. The HTTP client (`src/api/http.ts`) maps
to the endpoints in `backend-architecture.md`.

## Route map

| Route | Screen |
|---|---|
| `/login`, `/register` | Operator auth |
| `/dashboard` | Command center: wallet summary, live ledger, agent status |
| `/wallets`, `/wallets/:id` | Wallet list & detail (spend chart + ledger) |
| `/wallets/:id/deposit` | Mollie deposit flow |
| `/wallets/deposit/success` | Post-Mollie payment confirmation (polling) |
| `/agents`, `/agents/new` | Agent registry & KYA registration (API key reveal) |
| `/agents/:id`, `/agents/:id/policy` | Agent detail (tabs) & spend policy editor |
| `/transactions`, `/transactions/:id` | Global audit log & transaction detail |
| `/settings` | Operator account settings |

## Project structure

```
src/
  api/            FluxApi interface, HTTP client, in-memory mock + simulation
  components/     UI primitives, charts, layout, dashboard & domain widgets
  context/        Auth, Wallet, Toast providers
  hooks/          useAsync, polling/live-ledger helpers
  lib/            formatting & policy helpers
  pages/          one component per route
  types/          entities & API contracts (mirror backend-architecture.md)
```

## Real-time strategy

| Screen | Strategy |
|---|---|
| Dashboard live feed | push (mock) / 2s poll (live) |
| Agent burn-rate meters | live refresh |
| Wallet balance | refresh on tab focus |
| Deposit success | poll payment status (2s, max ~30s) |
| Transaction detail | static (immutable) |
