import { Request, Response, NextFunction } from "express";

/**
 * Require an authenticated human operator.
 *
 * Skeleton stub: Base44 provides built-in user auth. This placeholder reads the
 * bearer token and treats it as the user id. Replace with real JWT validation
 * against Base44's auth provider.
 */
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
  // TODO: verify token with Base44 auth and resolve the real user id.
  req.userId = token;
  next();
}
