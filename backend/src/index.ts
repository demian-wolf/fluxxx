import { createApp } from "./app";
import { config } from "./config/env";

const app = createApp();

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`FLUX backend listening on port ${config.port}`);
});
