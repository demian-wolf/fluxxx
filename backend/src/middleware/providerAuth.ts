import { Request, Response, NextFunction } from "express";
import { config } from "../config/env";

/**
 * Require a valid provider API key (header `X-FLUX-Provider-Key`).
 * Used by payee/paywall providers calling POST /api/tokens/verify.
 */
export function providerAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const key = req.header("x-flux-provider-key");
  if (!key || key !== config.flux.providerApiKey) {
    res.status(401).json({ error: "invalid_provider_key" });
    return;
  }
  next();
}
