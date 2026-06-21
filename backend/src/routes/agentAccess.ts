import crypto from "crypto";
import { Request, Router } from "express";
import { and, desc, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { config } from "../config/env";
import { db } from "../db";
import { agentAccessRequestsTable, agentIdentitiesTable, agentWalletsTable, spendPoliciesTable } from "../db/schema";
import { userAuth } from "../middleware/userAuth";
import { generateAgentApiKey, hashApiKey } from "../services/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

const DEFAULT_REQUEST_TTL_SECONDS = 15 * 60;
const MAX_REQUEST_TTL_SECONDS = 24 * 60 * 60;
const DEFAULT_HOURLY_LIMIT_CENTS = 200;
const DEFAULT_PER_TX_LIMIT_CENTS = 10;
const DEFAULT_DAILY_LIMIT_CENTS = 1000;

const moneyLimitSchema = z.number().int().min(0).max(1_000_000_000);
const domainSchema = z.string().trim().min(1).max(253);
const limitsSchema = z.object({
  hourly_limit_cents: moneyLimitSchema.optional(),
  per_tx_limit_cents: moneyLimitSchema.optional(),
  daily_limit_cents: moneyLimitSchema.optional(),
  allowed_domains: z.array(domainSchema).max(100).optional(),
  blocked_domains: z.array(domainSchema).max(100).optional(),
}).strict();

const createRequestSchema = z.object({
  wallet_id: z.string().uuid(),
  agent_name: z.string().trim().min(1).max(120),
  purpose: z.string().trim().min(1).max(1000).optional(),
  requested_scopes: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  metadata: z.record(z.unknown()).optional(),
  limits: limitsSchema.optional(),
  requested_limits: limitsSchema.optional(),
  expires_in_seconds: z.number().int().min(60).max(MAX_REQUEST_TTL_SECONDS).optional(),
}).strict();

const listRequestsQuerySchema = z.object({
  wallet_id: z.string().uuid().optional(),
  status: z.enum(["pending", "approved", "denied", "expired"]).optional(),
}).strict();

const approveRequestSchema = z.object({
  agent_name: z.string().trim().min(1).max(120).optional(),
  limits: limitsSchema.optional(),
}).strict();

const denyRequestSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
}).strict();

interface AccessRequestView {
  id: string;
  walletId: string;
  ownerId: string;
  requestCode: string;
  agentName: string;
  requestedScopes: string[];
  requestedMetadata: Record<string, unknown>;
  hourlyLimitCents: number | null;
  perTxLimitCents: number | null;
  dailyLimitCents: number | null;
  allowedDomains: string[] | null;
  blockedDomains: string[] | null;
  status: "pending" | "approved" | "denied" | "expired";
  statusReason: string | null;
  reviewedBy: string | null;
  agentId: string | null;
  agentApiKeyOnce?: string | null;
  apiKeyDeliveredAt: Date | null;
  expiresAt: Date;
  approvedAt: Date | null;
  deniedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const safeRequestSelect = {
  id:                agentAccessRequestsTable.id,
  walletId:          agentAccessRequestsTable.walletId,
  ownerId:           agentAccessRequestsTable.ownerId,
  requestCode:       agentAccessRequestsTable.requestCode,
  agentName:         agentAccessRequestsTable.agentName,
  requestedScopes:   agentAccessRequestsTable.requestedScopes,
  requestedMetadata: agentAccessRequestsTable.requestedMetadata,
  hourlyLimitCents:  agentAccessRequestsTable.hourlyLimitCents,
  perTxLimitCents:   agentAccessRequestsTable.perTxLimitCents,
  dailyLimitCents:   agentAccessRequestsTable.dailyLimitCents,
  allowedDomains:    agentAccessRequestsTable.allowedDomains,
  blockedDomains:    agentAccessRequestsTable.blockedDomains,
  status:            agentAccessRequestsTable.status,
  statusReason:      agentAccessRequestsTable.statusReason,
  reviewedBy:        agentAccessRequestsTable.reviewedBy,
  agentId:           agentAccessRequestsTable.agentId,
  apiKeyDeliveredAt: agentAccessRequestsTable.apiKeyDeliveredAt,
  expiresAt:         agentAccessRequestsTable.expiresAt,
  approvedAt:        agentAccessRequestsTable.approvedAt,
  deniedAt:          agentAccessRequestsTable.deniedAt,
  createdAt:         agentAccessRequestsTable.createdAt,
  updatedAt:         agentAccessRequestsTable.updatedAt,
};

function normalizeRequestCode(value: string): string {
  return value.trim().toUpperCase();
}

function generateRequestCode(): string {
  return `AGT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function originFromRequest(req: Request): string {
  const host = req.get("host");
  if (!host) return config.flux.appUrl.replace(/\/+$/, "");
  return `${req.protocol}://${host}`.replace(/\/+$/, "");
}

function appBaseUrl(req: Request): string {
  return (config.flux.appUrl || originFromRequest(req)).replace(/\/+$/, "");
}

function statusUrl(req: Request, requestId: string, requestCode: string): string {
  const query = new URLSearchParams({ request_code: requestCode });
  return `${originFromRequest(req)}/api/agent-access/requests/${requestId}?${query.toString()}`;
}

function authorizeUrl(req: Request, requestId: string, requestCode: string): string {
  const query = new URLSearchParams({ request_id: requestId, code: requestCode });
  return `${appBaseUrl(req)}/agent-access/authorize?${query.toString()}`;
}

function requestCodeFrom(req: Request): string | null {
  const queryCode = typeof req.query.request_code === "string"
    ? req.query.request_code
    : typeof req.query.code === "string" ? req.query.code : undefined;
  const headerCode = req.header("x-flux-request-code");
  const rawCode = queryCode ?? headerCode;
  return rawCode ? normalizeRequestCode(rawCode) : null;
}

function serializeRequest(row: AccessRequestView, apiKey?: string) {
  const limits = {
    hourly_limit_cents: row.hourlyLimitCents,
    per_tx_limit_cents: row.perTxLimitCents,
    daily_limit_cents:  row.dailyLimitCents,
    allowed_domains:    row.allowedDomains ?? [],
    blocked_domains:    row.blockedDomains ?? [],
  };

  return {
    id:                     row.id,
    request_id:             row.id,
    request_code:           row.requestCode,
    wallet_id:              row.walletId,
    agent_name:             row.agentName,
    requested_scopes:       row.requestedScopes,
    metadata:               row.requestedMetadata,
    limits,
    requested_limits:       limits,
    approved_limits:        row.status === "approved" ? limits : null,
    status:                 row.status,
    status_reason:          row.statusReason,
    reviewed_by:            row.reviewedBy,
    agent_id:               row.agentId,
    api_key:                apiKey,
    api_key_available:      row.status === "approved" && row.agentApiKeyOnce != null && row.apiKeyDeliveredAt == null,
    api_key_delivered_at:   row.apiKeyDeliveredAt?.toISOString() ?? null,
    expires_at:             row.expiresAt.toISOString(),
    approved_at:            row.approvedAt?.toISOString() ?? null,
    denied_at:              row.deniedAt?.toISOString() ?? null,
    created_at:             row.createdAt.toISOString(),
    updated_at:             row.updatedAt.toISOString(),
  };
}

async function expirePendingRequestsForOwner(ownerId: string): Promise<void> {
  await db
    .update(agentAccessRequestsTable)
    .set({ status: "expired", statusReason: "request_expired", updatedAt: new Date() })
    .where(
      and(
        eq(agentAccessRequestsTable.ownerId, ownerId),
        eq(agentAccessRequestsTable.status, "pending"),
        lt(agentAccessRequestsTable.expiresAt, new Date()),
      ),
    );
}

/**
 * POST /api/agent-access/requests
 * Public CLI/agent entrypoint: request access to a human-managed wallet.
 */
router.post(
  "/requests",
  asyncHandler(async (req, res) => {
    const parsed = createRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
      return;
    }

    const [wallet] = await db
      .select({ id: agentWalletsTable.id, ownerId: agentWalletsTable.ownerId })
      .from(agentWalletsTable)
      .where(eq(agentWalletsTable.id, parsed.data.wallet_id))
      .limit(1);

    if (!wallet) {
      res.status(404).json({ error: "wallet_not_found" });
      return;
    }

    const requestCode = generateRequestCode();
    const expiresAt = new Date(Date.now() + (parsed.data.expires_in_seconds ?? DEFAULT_REQUEST_TTL_SECONDS) * 1000);
    const requestedScopes = Array.from(new Set(parsed.data.requested_scopes ?? []));
    const limits = parsed.data.limits ?? parsed.data.requested_limits;
    const metadata = {
      ...(parsed.data.metadata ?? {}),
      ...(parsed.data.purpose ? { purpose: parsed.data.purpose } : {}),
    };

    const [request] = await db
      .insert(agentAccessRequestsTable)
      .values({
        walletId:          wallet.id,
        ownerId:           wallet.ownerId,
        requestCode,
        agentName:         parsed.data.agent_name,
        requestedScopes,
        requestedMetadata: metadata,
        hourlyLimitCents:  limits?.hourly_limit_cents,
        perTxLimitCents:   limits?.per_tx_limit_cents,
        dailyLimitCents:   limits?.daily_limit_cents,
        allowedDomains:    limits?.allowed_domains,
        blockedDomains:    limits?.blocked_domains,
        expiresAt,
      })
      .returning(safeRequestSelect);

    res.status(201).json({
      ...serializeRequest(request),
      authorize_url: authorizeUrl(req, request.id, request.requestCode),
      status_url:    statusUrl(req, request.id, request.requestCode),
    });
  }),
);

/**
 * GET /api/agent-access/requests/:request_id
 * Public CLI polling endpoint. Requires the request code returned at creation.
 * If approved, the API key is returned once and immediately cleared.
 */
router.get(
  "/requests/:request_id",
  asyncHandler(async (req, res) => {
    const requestIdParse = z.string().uuid().safeParse(req.params.request_id);
    const requestCode = requestCodeFrom(req);
    if (!requestIdParse.success || !requestCode) {
      res.status(400).json({ error: "invalid_request_lookup" });
      return;
    }

    const now = new Date();
    const result = await db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(agentAccessRequestsTable)
        .where(
          and(
            eq(agentAccessRequestsTable.id, requestIdParse.data),
            eq(agentAccessRequestsTable.requestCode, requestCode),
          ),
        )
        .limit(1)
        .for("update");

      if (!request) return null;

      if (request.status === "pending" && request.expiresAt.getTime() <= now.getTime()) {
        const [expired] = await tx
          .update(agentAccessRequestsTable)
          .set({ status: "expired", statusReason: "request_expired", updatedAt: now })
          .where(eq(agentAccessRequestsTable.id, request.id))
          .returning();
        return { request: expired, apiKey: undefined };
      }

      if (request.status === "approved" && request.agentApiKeyOnce && !request.apiKeyDeliveredAt) {
        await tx
          .update(agentAccessRequestsTable)
          .set({ agentApiKeyOnce: null, apiKeyDeliveredAt: now, updatedAt: now })
          .where(eq(agentAccessRequestsTable.id, request.id));
        return {
          request: { ...request, agentApiKeyOnce: null, apiKeyDeliveredAt: now, updatedAt: now },
          apiKey:  request.agentApiKeyOnce,
        };
      }

      return { request, apiKey: undefined };
    });

    if (!result) {
      res.status(404).json({ error: "request_not_found" });
      return;
    }

    res.json(serializeRequest(result.request, result.apiKey));
  }),
);

/**
 * GET /api/agent-access/operator/requests
 * Operator view of access requests for their wallets.
 */
router.get(
  "/operator/requests",
  userAuth,
  asyncHandler(async (req, res) => {
    const parsed = listRequestsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_query", details: parsed.error.flatten() });
      return;
    }

    await expirePendingRequestsForOwner(req.userId as string);

    const conditions = [eq(agentAccessRequestsTable.ownerId, req.userId as string)];
    if (parsed.data.wallet_id) {
      conditions.push(eq(agentAccessRequestsTable.walletId, parsed.data.wallet_id));
    }
    if (parsed.data.status) {
      conditions.push(eq(agentAccessRequestsTable.status, parsed.data.status));
    }

    const requests = await db
      .select(safeRequestSelect)
      .from(agentAccessRequestsTable)
      .where(and(...conditions))
      .orderBy(desc(agentAccessRequestsTable.createdAt))
      .limit(100);

    res.json({ requests: requests.map((request) => serializeRequest(request)) });
  }),
);

/**
 * POST /api/agent-access/operator/requests/:request_id/approve
 * Operator approval creates the agent identity and stages the raw API key for
 * one CLI poll. The raw key is not returned here.
 */
router.post(
  "/operator/requests/:request_id/approve",
  userAuth,
  asyncHandler(async (req, res) => {
    const requestIdParse = z.string().uuid().safeParse(req.params.request_id);
    const bodyParse = approveRequestSchema.safeParse(req.body ?? {});
    if (!requestIdParse.success || !bodyParse.success) {
      res.status(400).json({
        error: "invalid_approval_request",
        details: bodyParse.success ? undefined : bodyParse.error.flatten(),
      });
      return;
    }

    const now = new Date();
    const result = await db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(agentAccessRequestsTable)
        .where(
          and(
            eq(agentAccessRequestsTable.id, requestIdParse.data),
            eq(agentAccessRequestsTable.ownerId, req.userId as string),
          ),
        )
        .limit(1)
        .for("update");

      if (!request) return { error: "request_not_found" as const };
      if (request.status !== "pending") return { error: "request_not_pending" as const, status: request.status };
      if (request.expiresAt.getTime() <= now.getTime()) {
        await tx
          .update(agentAccessRequestsTable)
          .set({ status: "expired", statusReason: "request_expired", updatedAt: now })
          .where(eq(agentAccessRequestsTable.id, request.id));
        return { error: "request_expired" as const };
      }

      const rawKey = generateAgentApiKey();
      const limits = bodyParse.data.limits;
      const policyRules = {
        hourly_limit_cents: limits?.hourly_limit_cents ?? request.hourlyLimitCents ?? DEFAULT_HOURLY_LIMIT_CENTS,
        per_tx_limit_cents: limits?.per_tx_limit_cents ?? request.perTxLimitCents ?? DEFAULT_PER_TX_LIMIT_CENTS,
        daily_limit_cents:  limits?.daily_limit_cents ?? request.dailyLimitCents ?? DEFAULT_DAILY_LIMIT_CENTS,
        allowed_domains:    limits?.allowed_domains ?? request.allowedDomains ?? [],
        blocked_domains:    limits?.blocked_domains ?? request.blockedDomains ?? [],
      };
      const [agent] = await tx
        .insert(agentIdentitiesTable)
        .values({
          walletId:         request.walletId,
          ownerId:          request.ownerId,
          name:             bodyParse.data.agent_name ?? request.agentName,
          apiKeyHash:       hashApiKey(rawKey),
          hourlyLimitCents: policyRules.hourly_limit_cents,
          perTxLimitCents:  policyRules.per_tx_limit_cents,
          dailyLimitCents:  policyRules.daily_limit_cents,
          allowedDomains:   policyRules.allowed_domains,
        })
        .returning({ id: agentIdentitiesTable.id });

      await tx.insert(spendPoliciesTable).values({
        agentId:   agent.id,
        version:   1,
        rules:     policyRules,
        isActive:  true,
        createdBy: request.ownerId,
      });

      const [updatedRequest] = await tx
        .update(agentAccessRequestsTable)
        .set({
          status:           "approved",
          reviewedBy:       req.userId as string,
          agentId:          agent.id,
          agentApiKeyOnce:  rawKey,
          approvedAt:       now,
          updatedAt:        now,
        })
        .where(eq(agentAccessRequestsTable.id, request.id))
        .returning(safeRequestSelect);

      return { request: updatedRequest, agentId: agent.id };
    });

    if ("error" in result) {
      const statusCode = result.error === "request_not_found" ? 404 : 409;
      res.status(statusCode).json(result);
      return;
    }

    res.status(201).json({
      approved: true,
      request:  serializeRequest(result.request),
      agent_id: result.agentId,
      warning:  "The agent API key is available once via the CLI polling endpoint.",
    });
  }),
);

/**
 * POST /api/agent-access/operator/requests/:request_id/deny
 * Operator denial closes a pending request without creating an agent identity.
 */
router.post(
  "/operator/requests/:request_id/deny",
  userAuth,
  asyncHandler(async (req, res) => {
    const requestIdParse = z.string().uuid().safeParse(req.params.request_id);
    const bodyParse = denyRequestSchema.safeParse(req.body ?? {});
    if (!requestIdParse.success || !bodyParse.success) {
      res.status(400).json({
        error: "invalid_denial_request",
        details: bodyParse.success ? undefined : bodyParse.error.flatten(),
      });
      return;
    }

    const now = new Date();
    const result = await db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(agentAccessRequestsTable)
        .where(
          and(
            eq(agentAccessRequestsTable.id, requestIdParse.data),
            eq(agentAccessRequestsTable.ownerId, req.userId as string),
          ),
        )
        .limit(1)
        .for("update");

      if (!request) return { error: "request_not_found" as const };
      if (request.status !== "pending") return { error: "request_not_pending" as const, status: request.status };
      if (request.expiresAt.getTime() <= now.getTime()) {
        const [expired] = await tx
          .update(agentAccessRequestsTable)
          .set({ status: "expired", statusReason: "request_expired", updatedAt: now })
          .where(eq(agentAccessRequestsTable.id, request.id))
          .returning(safeRequestSelect);
        return { request: expired, expired: true };
      }

      const [updatedRequest] = await tx
        .update(agentAccessRequestsTable)
        .set({
          status:       "denied",
          statusReason: bodyParse.data.reason ?? "denied_by_operator",
          reviewedBy:   req.userId as string,
          deniedAt:     now,
          updatedAt:    now,
        })
        .where(eq(agentAccessRequestsTable.id, request.id))
        .returning(safeRequestSelect);

      return { request: updatedRequest, expired: false };
    });

    if ("error" in result) {
      const statusCode = result.error === "request_not_found" ? 404 : 409;
      res.status(statusCode).json(result);
      return;
    }

    res.json({
      denied:  !result.expired,
      expired: result.expired,
      request: serializeRequest(result.request),
    });
  }),
);

export default router;
