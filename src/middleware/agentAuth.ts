import { Request, Response, NextFunction } from "express";
import { verifySessionToken, AgentSessionClaims } from "../services/auth";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      agent?: AgentSessionClaims;
      userId?: string;
    }
  }
}

function bearerToken(req: Request): string | null {
  const header = req.header("authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim();
}

/** Require a valid agent session JWT (issued by POST /api/auth/agent). */
export function agentAuth(req: Request, res: Response, next: NextFunction): void {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: "missing_session_token" });
    return;
  }
  try {
    req.agent = verifySessionToken(token);
    next();
  } catch {
    res.status(401).json({ error: "invalid_session_token" });
  }
}
