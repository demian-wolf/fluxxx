---
name: testing-fluxxx-frontend
description: Test the FLUXXX frontend end-to-end in demo mode. Use when verifying agent/wallet/policy UI changes (e.g. the agent spend tree).
---

# Testing the FLUXXX frontend

The frontend runs fully standalone in **demo mode** against an in-memory mock — no backend, DB, or secrets needed. This makes most UI changes testable end-to-end locally.

## Run it
```bash
(cd frontend && npm install && npm run dev)   # http://localhost:5173
```
Note: if port 5173 is in use, Vite auto-increments (5174, 5175, etc). Check the terminal output for the actual port. You can also force a specific port: `npx vite --port 5180`.

Login page (`/login`) is prefilled in demo mode — **any** email/password works; just click "Sign in". A "Demo mode" badge is shown bottom-left.

## Where the mock lives
- Seed data (agents, wallets, ledger): `frontend/src/api/mock/store.ts`
- Mock API behavior: `frontend/src/api/mock/mockApi.ts`
- The mock mirrors backend semantics, so testing through it is a reasonable proxy for backend logic that has no live DB available. Call this out in reports (mock, not live Postgres).

## Agent spend tree (PR #6) specifics
- Tree UI: `frontend/src/pages/AgentsPage.tsx` + `frontend/src/lib/agentTree.ts` (buildAgentForest/flattenForest).
- Seed tree: ResearchBot v1 → DataMiner → EmbeddingsWorker; CrawlerOps → LinkHarvester.
- Key adversarial checks:
  - Nesting: rows are indented, parents show a chevron + "N sub" badge.
  - Collapse hides the WHOLE subtree (grandchildren too), not just direct children.
  - **Cascade**: clicking "Suspend" on an active parent must flip its descendants to suspended too; an unrelated tree must stay active. If only the parent changes, cascade is broken.
  - Register child: "Add sub-agent" on a detail page deep-links `/agents/new?wallet=...&parent=...`; the new agent must appear nested under that parent and bump its "N sub" badge.

## Agent-initiated spawn (PR #8) specifics
- Spawn UI: `frontend/src/pages/AgentDetailPage.tsx` — "Spawn" button (Zap icon) in the Sub-agents card header.
- Backend endpoint: `POST /api/agents/spawn` (agentAuth). Mock equivalent in `mockApi.ts`.
- Key test flows:
  - **Happy path**: Use CrawlerOps (daily=5000, child LinkHarvester=2000, remaining=3000). Spawn a child with daily <= 3000. Verify API key shown + child in list.
  - **Over-budget**: Enter daily_limit > remaining. Button must stay disabled. Change to valid value → button enables.
  - **Negative budget**: ResearchBot v1 (daily=1000, child DataMiner=3000) has remaining=-2000. Button disabled regardless of input — this tests pre-existing over-allocation from operator-created agents.
  - **Budget math display**: Form shows "Budget remaining: €X.XX/day (parent €Y.YY − allocated €Z.ZZ)". Verify arithmetic is correct.
- Policy gating: `can_spawn: false` on an agent's active policy should return "spawn_not_permitted". This is enforced in the mock but no seed agent has it set to false by default — you'd need to edit the policy first via Edit Policy page to test this path.

## Lint/typecheck/build
```bash
(cd frontend && npm run lint && npm run typecheck && npm run build)
(cd backend && npm run lint && npm run typecheck && npm run build)
```

## Devin Secrets Needed
None — demo mode requires no secrets.
