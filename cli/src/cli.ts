#!/usr/bin/env node
import { getStringFlag, hasFlag, parseCommand } from "./args";
import { defaultConfigPath, readConfig } from "./config";
import { DEFAULT_API_BASE_URL } from "./endpoints";
import { runCommand } from "./commands";
import { errorPayload, printJson } from "./output";
import type { CommandContext } from "./types";

async function main(): Promise<void> {
  const parsed = parseCommand(process.argv.slice(2));
  const configPath = getStringFlag(parsed.flags, ["config"]) ?? defaultConfigPath();
  const config = await readConfig(configPath);
  const apiBaseUrl = getStringFlag(parsed.flags, ["api-base-url"]) ?? process.env.FLUX_API_BASE_URL ?? config.apiBaseUrl ?? DEFAULT_API_BASE_URL;
  const ctx: CommandContext = {
    apiBaseUrl,
    configPath,
    config,
    json: hasFlag(parsed.flags, "json"),
    save: !hasFlag(parsed.flags, "no-save"),
    showSecrets: hasFlag(parsed.flags, "show-secrets"),
    outputPath: getStringFlag(parsed.flags, ["output"]),
  };

  await runCommand(ctx, parsed);
}

main().catch((error: unknown) => {
  const parsed = parseCommand(process.argv.slice(2));
  if (hasFlag(parsed.flags, "json")) {
    printJson(errorPayload(parsed.command, error));
  } else if (error instanceof Error) {
    process.stderr.write(`${error.message}\n`);
  } else {
    process.stderr.write(`${String(error)}\n`);
  }
  process.exitCode = 1;
});
