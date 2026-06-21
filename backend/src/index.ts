// Must be imported first so dotenv populates process.env before any other
// module (e.g. ./db, which reads process.env.DATABASE_URL) is loaded.
import { config } from "./config/env";
import { createApp } from "./app";
import { sweep } from "./services/capitalReclamation";

const GC_INTERVAL_MS = Number(process.env.FLUX_GC_INTERVAL_MS ?? 5 * 60 * 1000);

const app = createApp();

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`FLUX backend listening on port ${config.port}`);

  // Background capital reclamation sweep (Agentic GC)
  setInterval(async () => {
    try {
      const result = await sweep();
      if (result.eventsCreated.length > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[GC] Sweep complete: ${result.eventsCreated.length} agents reclaimed, ` +
          `${result.totalReclaimedCents}c freed, ` +
          `${result.totalLimitFreed}c daily limit capacity restored`,
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[GC] Sweep failed:", err);
    }
  }, GC_INTERVAL_MS);
});
