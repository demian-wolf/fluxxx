import { Request, Response, NextFunction } from "express";
import { verifyUserToken } from "../services/auth";

/** Require an authenticated human operator (JWT issued by POST /api/auth/login). */
export function userAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    res.status(401).json({ error: "missing_user_token" });
    return;
  }
  const token = header.slice(7).trim();
  if (token === "") {
    res.status(401).json({ error: "invalid_user_token" });
    return;
  }
  try {
    const claims = verifyUserToken(token);
    req.userId = claims.sub;
    next();
  } catch {
    res.status(401).json({ error: "invalid_user_token" });
  }
}
