import { Router } from "express";
import { userAuth } from "../middleware/userAuth";
import { asyncHandler } from "../utils/asyncHandler";
import {
  listCurrencies,
  getAllRates,
  convertCurrency,
  getExchangeRate,
} from "../services/multicurrency";
import type { SupportedCurrency } from "../services/multicurrency";

const router = Router();

/**
 * GET /api/currency/list
 * List all supported currencies.
 */
router.get(
  "/list",
  userAuth,
  asyncHandler(async (_req, res) => {
    const currencies = listCurrencies();
    res.json(currencies);
  }),
);

/**
 * GET /api/currency/rates
 * Get all current exchange rates.
 */
router.get(
  "/rates",
  userAuth,
  asyncHandler(async (_req, res) => {
    const rates = getAllRates();
    res.json(rates);
  }),
);

/**
 * GET /api/currency/rate?from=EUR&to=USD
 * Get exchange rate between two currencies.
 */
router.get(
  "/rate",
  userAuth,
  asyncHandler(async (req, res) => {
    const from = req.query.from as SupportedCurrency | undefined;
    const to = req.query.to as SupportedCurrency | undefined;

    if (!from || !to) {
      res.status(400).json({ error: "missing_from_or_to" });
      return;
    }

    const rate = getExchangeRate(from, to);
    res.json(rate);
  }),
);

/**
 * POST /api/currency/convert
 * Convert an amount between currencies.
 */
router.post(
  "/convert",
  userAuth,
  asyncHandler(async (req, res) => {
    const { amount_cents, from, to } = req.body ?? {};

    if (typeof amount_cents !== "number" || typeof from !== "string" || typeof to !== "string") {
      res.status(400).json({ error: "missing_required_fields" });
      return;
    }

    const result = convertCurrency(amount_cents, from as SupportedCurrency, to as SupportedCurrency);
    res.json(result);
  }),
);

export default router;
