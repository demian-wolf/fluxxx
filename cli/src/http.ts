import type { JsonObject } from "./types";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(apiErrorMessage(status, body));
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

interface RequestJsonInput {
  apiBaseUrl: string;
  endpoint: string;
  method: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
  allowStatuses?: number[];
}

export async function requestJson(input: RequestJsonInput): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${normalizeBaseUrl(input.apiBaseUrl)}${input.endpoint}`, {
    method: input.method,
    headers: {
      accept: "application/json",
      ...(input.body === undefined ? {} : { "content-type": "application/json" }),
      ...(input.headers ?? {}),
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });

  const body = await parseResponseBody(response);
  if (!response.ok && !(input.allowStatuses ?? []).includes(response.status)) {
    throw new ApiError(response.status, body);
  }

  return { status: response.status, body };
}

export function normalizeBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/+$/, "");
}

function apiErrorMessage(status: number, body: unknown): string {
  if (isObject(body)) {
    const error = body.error;
    if (typeof error === "string") return `HTTP ${status}: ${error}`;
    const message = body.message;
    if (typeof message === "string") return `HTTP ${status}: ${message}`;
  }
  return `HTTP ${status}`;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
