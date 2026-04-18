import type { Request, Response, NextFunction } from "express";
import { getConfig } from "../lib/config";
import { logger } from "../lib/logger";
import { emitAuditEvent } from "../lib/auditLog";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitEntry>();

function cleanExpired(): void {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

const cleanupTimer = setInterval(cleanExpired, 60_000);
cleanupTimer.unref?.();

function getClientKey(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return ip;
}

function checkLimit(
  key: string,
  windowMs: number,
  maxRequests: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  entry.count += 1;
  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

export function rateLimiter(tier: "default" | "run" = "default") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const config = getConfig();
    const clientKey = getClientKey(req);
    const bucketKey = `${tier}:${clientKey}`;

    const maxRequests =
      tier === "run" ? config.rateLimitRunMaxRequests : config.rateLimitMaxRequests;

    const result = checkLimit(bucketKey, config.rateLimitWindowMs, maxRequests);

    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, result.remaining));
    res.setHeader("X-RateLimit-Reset", Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      logger.warn(
        {
          clientKey,
          tier,
          url: req.url,
          correlationId: req.correlationId,
        },
        "Rate limit exceeded",
      );
      emitAuditEvent({ action: "rate_limit.exceeded", correlationId: req.correlationId, details: { tier, url: req.url, clientKey } });
      res.status(429).json({
        error: "Too many requests",
        code: "RATE_LIMITED",
        retryAfterMs: result.resetAt - Date.now(),
      });
      return;
    }

    next();
  };
}

export function bodyLimitGuard(req: Request, res: Response, next: NextFunction): void {
  const config = getConfig();
  const contentLength = Number(req.headers["content-length"] || 0);

  if (contentLength > config.bodyLimitBytes) {
    logger.warn(
      {
        contentLength,
        limit: config.bodyLimitBytes,
        correlationId: req.correlationId,
      },
      "Request body too large",
    );
    res.status(413).json({
      error: "Payload too large",
      code: "PAYLOAD_TOO_LARGE",
      maxBytes: config.bodyLimitBytes,
      receivedBytes: contentLength,
    });
    return;
  }

  next();
}
