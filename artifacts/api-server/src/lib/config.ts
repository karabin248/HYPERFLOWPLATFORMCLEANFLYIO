import { logger } from "./logger";

export interface PlatformConfig {
  nodeEnv: string;
  hardenedMode: boolean;
  apiToken: string | null;
  coreUrl: string;
  coreTimeoutMs: number;
  defaultRunTimeoutMs: number;
  maxConcurrentRuns: number;
  maxRetryCount: number;
  bodyLimitBytes: number;
  promptMaxLength: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  rateLimitRunMaxRequests: number;
}

function env(key: string, fallback?: string): string | undefined {
  return process.env[key] ?? fallback;
}

function requireEnv(key: string, hardenedMode: boolean): string {
  const value = process.env[key];
  if (!value && hardenedMode) {
    logger.fatal({ key }, "Required env var missing in hardened mode");
    process.exit(1);
  }
  return value ?? "";
}

export function loadConfig(): PlatformConfig {
  const nodeEnv = env("NODE_ENV", "development") as string;
  const hardenedMode = env("HARDENED_MODE", "true") === "true";

  const apiToken = hardenedMode
    ? requireEnv("API_TOKEN", hardenedMode)
    : env("API_TOKEN") ?? null;

  const coreUrl = env("HYPERFLOW_CORE_URL", "http://localhost:8000") as string;
  const coreTimeoutMs = Number(env("CORE_TIMEOUT_MS", "30000"));
  const defaultRunTimeoutMs = Number(env("DEFAULT_RUN_TIMEOUT_MS", "60000"));
  const maxConcurrentRuns = Number(env("MAX_CONCURRENT_RUNS", "10"));
  const maxRetryCount = Number(env("MAX_RETRY_COUNT", "3"));
  const bodyLimitBytes = Number(env("BODY_LIMIT_BYTES", "1048576"));
  const promptMaxLength = Number(env("PROMPT_MAX_LENGTH", "50000"));
  const rateLimitWindowMs = Number(env("RATE_LIMIT_WINDOW_MS", "60000"));
  const rateLimitMaxRequests = Number(env("RATE_LIMIT_MAX_REQUESTS", "100"));
  const rateLimitRunMaxRequests = Number(env("RATE_LIMIT_RUN_MAX_REQUESTS", "20"));

  if (hardenedMode) {
    logger.info("Starting in HARDENED mode");
    if (!apiToken) {
      logger.fatal("API_TOKEN is required in hardened mode");
      process.exit(1);
    }
  } else {
    logger.warn("Starting in DEVELOPMENT mode — AUTH_BYPASS=TRUE. Set HARDENED_MODE=true in production.");
  }

  return {
    nodeEnv,
    hardenedMode,
    apiToken,
    coreUrl,
    coreTimeoutMs,
    defaultRunTimeoutMs,
    maxConcurrentRuns,
    maxRetryCount,
    bodyLimitBytes,
    promptMaxLength,
    rateLimitWindowMs,
    rateLimitMaxRequests,
    rateLimitRunMaxRequests,
  };
}

let _config: PlatformConfig | null = null;

export function getConfig(): PlatformConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}
