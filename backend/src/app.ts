import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import agentRoutes from "./routes/agents";
import transactionRoutes from "./routes/transactions";
import tokenRoutes from "./routes/tokens";
import paymentRoutes from "./routes/payments";
import webhookRoutes from "./routes/webhooks";
import walletRoutes from "./routes/wallets";
import gcRoutes from "./routes/gc";
import oobRoutes from "./routes/oob";
import forecastingRoutes from "./routes/forecasting";
import reputationRoutes from "./routes/reputation";
import alertRoutes from "./routes/alerts";
import approvalRoutes from "./routes/approval";
import pluginRoutes from "./routes/plugins";
import currencyRoutes from "./routes/currency";

export function createApp(): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "flux-backend" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/agents", agentRoutes);
  app.use("/api/transactions", transactionRoutes);
  app.use("/api/tokens", tokenRoutes);
  app.use("/api/payments", paymentRoutes);
  app.use("/api/webhooks", webhookRoutes);
  app.use("/api/wallets", walletRoutes);
  app.use("/api/gc", gcRoutes);
  app.use("/api/oob", oobRoutes);
  app.use("/api/forecasting", forecastingRoutes);
  app.use("/api/reputation", reputationRoutes);
  app.use("/api/alerts", alertRoutes);
  app.use("/api/approval", approvalRoutes);
  app.use("/api/plugins", pluginRoutes);
  app.use("/api/currency", currencyRoutes);

  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "internal_server_error" });
  });

  return app;
}
