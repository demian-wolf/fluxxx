# FLUX — Agentic Commerce Gateway

Human-governed wallets and payments for AI agents. Built with Node/Express + Drizzle + PostgreSQL on the backend and React + Vite on the frontend.

## Structure

- `backend/` — Express API, Drizzle ORM, Mollie payments, policy engine
- `frontend/` — React + Vite dashboard with a dedicated Payments page and mock Mollie checkout

## Quick Start

### Backend

```bash
cd backend
cp .env.example .env
# edit .env: DATABASE_URL, SESSION_SECRET, (optional) MOLLIE_API_KEY
npm install
npm run db:push
npm run dev
```

Backend runs on `http://localhost:3000`.

### Frontend

```bash
cd frontend
cp .env.example .env
# edit .env: VITE_API_BASE_URL=http://localhost:3000
npm install
npm run dev          # http://localhost:5173
```

Frontend runs on `http://localhost:5173`.

## Payments

- Real Mollie checkout via `POST /api/payments/deposit` when `MOLLIE_API_KEY` is set.
- Mock checkout via `POST /api/payments/mock-deposit` for testing without a real API key.
- The dedicated `/payments` page in the frontend lets you toggle between real and mock modes and simulate Pay / Fail / Cancel outcomes.
