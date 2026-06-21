import fs from "fs";
import path from "path";
import postgres from "postgres";
import { config } from "../config/env";

/**
 * Run all SQL migration files in backend/drizzle/ in lexicographic order.
 * Each file is executed inside a transaction. Already-applied changes are
 * idempotent (IF NOT EXISTS / IF EXISTS guards) so re-running is safe.
 *
 * Usage: npm run db:migrate
 */
async function main(): Promise<void> {
  const migrationsDir = path.resolve(__dirname, "../../drizzle");
  if (!fs.existsSync(migrationsDir)) {
    console.log("No drizzle/ directory found. Nothing to migrate.");
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No .sql files in drizzle/. Nothing to migrate.");
    return;
  }

  const sql = postgres(config.database.url, {
    max: 1,
    ssl: config.nodeEnv === "production" ? "require" : undefined,
  });

  try {
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      console.log(`Applying: ${file} ...`);
      await sql.unsafe(content);
      console.log(`  Done.`);
    }
    console.log(`\nAll ${files.length} migration(s) applied successfully.`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
