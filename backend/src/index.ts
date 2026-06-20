// Must be imported first so dotenv populates process.env before any other
// module (e.g. ./db, which reads process.env.DATABASE_URL) is loaded.
import { config } from "./config/env";
import { createApp } from "./app";

const app = createApp();

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`FLUX backend listening on port ${config.port}`);
});
