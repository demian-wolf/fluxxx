export interface ParsedCommand {
  command: string;
  flags: Map<string, string[]>;
  positionals: string[];
}

const TRUE_VALUE = "true";

export function parseCommand(argv: string[]): ParsedCommand {
  if (argv.length === 0) {
    return { command: "help", flags: new Map(), positionals: [] };
  }

  const [first, second, ...rest] = argv;
  if (first === "agent-access" && second === "request") {
    return { command: "request-access", ...parseFlags(rest) };
  }

  if (first === "agent-access" && second === "status") {
    return { command: "status", ...parseFlags(rest) };
  }

  if (first === "agent-access" && second === "wait") {
    return { command: "wait-access", ...parseFlags(rest) };
  }

  if (first === "agent" && (second === "auth" || second === "login")) {
    return { command: second, ...parseFlags(rest) };
  }

  if (first === "transaction" && second === "request") {
    return { command: "spend/request", ...parseFlags(rest) };
  }

  if (first === "spend" && second === "request") {
    return { command: "spend/request", ...parseFlags(rest) };
  }

  if (first === "spend/request") {
    return { command: "spend/request", ...parseFlags([second, ...rest].filter((value): value is string => value !== undefined)) };
  }

  return { command: first, ...parseFlags([second, ...rest].filter((value): value is string => value !== undefined)) };
}

function parseFlags(args: string[]): Pick<ParsedCommand, "flags" | "positionals"> {
  const flags = new Map<string, string[]>();
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const withoutPrefix = arg.slice(2);
    const equalsIndex = withoutPrefix.indexOf("=");
    if (equalsIndex >= 0) {
      addFlag(flags, withoutPrefix.slice(0, equalsIndex), withoutPrefix.slice(equalsIndex + 1));
      continue;
    }

    const next = args[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      addFlag(flags, withoutPrefix, next);
      index += 1;
      continue;
    }

    addFlag(flags, withoutPrefix, TRUE_VALUE);
  }

  return { flags, positionals };
}

function addFlag(flags: Map<string, string[]>, name: string, value: string): void {
  const existing = flags.get(name) ?? [];
  flags.set(name, [...existing, value]);
}

export function hasFlag(flags: Map<string, string[]>, name: string): boolean {
  return flags.has(name);
}

export function getStringFlag(flags: Map<string, string[]>, names: string[]): string | undefined {
  for (const name of names) {
    const values = flags.get(name);
    const value = values?.[values.length - 1];
    if (value !== undefined && value !== TRUE_VALUE) return value;
  }
  return undefined;
}

export function getNumberFlag(flags: Map<string, string[]>, names: string[]): number | undefined {
  const raw = getStringFlag(flags, names);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Expected numeric value for --${names[0]}`);
  }
  return value;
}

export function getListFlag(flags: Map<string, string[]>, names: string[]): string[] {
  const values = names.flatMap((name) => flags.get(name) ?? []);
  return values
    .filter((value) => value !== TRUE_VALUE)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function getJsonObjectFlag(flags: Map<string, string[]>, names: string[]): Record<string, unknown> | undefined {
  const raw = getStringFlag(flags, names);
  if (raw === undefined) return undefined;

  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Expected --${names[0]} to be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}
