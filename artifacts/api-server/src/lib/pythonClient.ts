import { logger } from "./logger";
import { getConfig } from "./config";

function getCoreUrl(): string {
  return getConfig().coreUrl;
}

function getCoreTimeoutMs(): number {
  return getConfig().coreTimeoutMs;
}

function getCoreToken(): string {
  return process.env.HYPERFLOW_CORE_TOKEN ?? "";
}

export interface CoreRunRequest {
  prompt: string;
  agent_id?: string;
  agent_version?: string;
  agent_role?: string;
  agent_capabilities?: string[];
  run_policy?: Record<string, unknown>;
}

export interface CoreResponse {
  run_id: string;
  intent: string;
  mode: string;
  output_type: string;
  result: Record<string, unknown>;
  contract: Record<string, unknown>;
  quality_score: number;
  canonical_combo: string;
  canonical_phases: string[];
  canonical_trace: {
    canonical_combo: string;
    canonical_phases: string[];
    phases_completed: string[];
    terminal_phase: string;
    order_preserved: boolean;
    cycle_version: string;
    mps_level: number;
    mps_name: string;
    canonical_combo_detected: boolean;
  };
  status: string;
  startedAt: string;
  completedAt: string;
  [key: string]: unknown;
}

export interface CoreError {
  code: string;
  message: string;
  status: number;
  details?: Record<string, unknown>;
}

export type CoreResult =
  | { ok: true; data: CoreResponse }
  | { ok: false; error: CoreError };

function makeCoreError(status: number, message: string, code: string, details?: Record<string, unknown>): CoreError {
  return { code, message, status, details };
}

async function fetchCore(path: string, options: RequestInit & { timeoutMs?: number; correlationId?: string; externalSignal?: AbortSignal } = {}): Promise<Response> {
  const { timeoutMs = getCoreTimeoutMs(), correlationId, externalSignal, ...fetchOpts } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (externalSignal) {
    externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const headers: Record<string, string> = {
    ...(fetchOpts.headers as Record<string, string> || {}),
  };
  if (correlationId) {
    headers["x-correlation-id"] = correlationId;
  }
  if (timeoutMs) {
    headers["x-timeout-hint-ms"] = String(timeoutMs);
  }
  const coreToken = getCoreToken();
  if (coreToken) {
    headers["x-internal-token"] = coreToken;
  }

  try {
    const resp = await fetch(`${getCoreUrl()}${path}`, {
      ...fetchOpts,
      headers,
      signal: controller.signal,
    });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

export async function health(): Promise<CoreResult> {
  try {
    const resp = await fetchCore("/v1/health");
    if (!resp.ok) {
      return { ok: false, error: makeCoreError(resp.status, "Core health check failed", "CORE_UNHEALTHY") };
    }
    const data = (await resp.json()) as CoreResponse;
    return { ok: true, data };
  } catch (err) {
    logger.error({ err }, "Core health check unreachable");
    return { ok: false, error: makeCoreError(503, "Core unreachable", "CORE_UNREACHABLE") };
  }
}

export async function run(prompt: string, timeoutMs?: number, correlationId?: string, externalSignal?: AbortSignal): Promise<CoreResult> {
  try {
    const resp = await fetchCore("/v1/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      timeoutMs,
      correlationId,
      externalSignal,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "unknown");
      return {
        ok: false,
        error: makeCoreError(resp.status, `Core returned ${resp.status}: ${text.slice(0, 200)}`, "CORE_ERROR"),
      };
    }

    const data = (await resp.json()) as CoreResponse;
    if ((data as Record<string, unknown>).error) {
      return {
        ok: false,
        error: makeCoreError(422, String((data as Record<string, unknown>).error), "CORE_EXECUTION_ERROR", data as unknown as Record<string, unknown>),
      };
    }
    return { ok: true, data };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      if (externalSignal?.aborted) {
        return { ok: false, error: makeCoreError(499, "Run cancelled", "RUN_CANCELLED") };
      }
      return { ok: false, error: makeCoreError(504, "Core request timed out", "CORE_TIMEOUT") };
    }
    logger.error({ err }, "Core run call failed");
    return { ok: false, error: makeCoreError(503, "Core unreachable", "CORE_UNREACHABLE") };
  }
}

export async function runAgent(request: CoreRunRequest, timeoutMs?: number, correlationId?: string, externalSignal?: AbortSignal): Promise<CoreResult> {
  try {
    const resp = await fetchCore("/v1/agent/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      timeoutMs,
      correlationId,
      externalSignal,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "unknown");
      return {
        ok: false,
        error: makeCoreError(resp.status, `Core returned ${resp.status}: ${text.slice(0, 200)}`, "CORE_ERROR"),
      };
    }

    const data = (await resp.json()) as CoreResponse;
    if ((data as Record<string, unknown>).error) {
      return {
        ok: false,
        error: makeCoreError(422, String((data as Record<string, unknown>).error), "CORE_EXECUTION_ERROR", data as unknown as Record<string, unknown>),
      };
    }
    return { ok: true, data };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      if (externalSignal?.aborted) {
        return { ok: false, error: makeCoreError(499, "Run cancelled", "RUN_CANCELLED") };
      }
      return { ok: false, error: makeCoreError(504, "Core request timed out", "CORE_TIMEOUT") };
    }
    logger.error({ err }, "Core agent run call failed");
    return { ok: false, error: makeCoreError(503, "Core unreachable", "CORE_UNREACHABLE") };
  }
}

export const pythonClient = { health, run, runAgent };
export default pythonClient;
