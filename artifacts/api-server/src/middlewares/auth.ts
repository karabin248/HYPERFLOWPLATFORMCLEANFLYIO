import { timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { getConfig } from "../lib/config";
import { logger } from "../lib/logger";
import { emitAuditEvent } from "../lib/auditLog";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const config = getConfig();

  if (!config.hardenedMode) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    logger.warn({ method: req.method, url: req.url, correlationId: req.correlationId }, "Auth missing");
    emitAuditEvent({ action: "auth.failed", correlationId: req.correlationId, details: { reason: "missing_token", method: req.method, url: req.url } });
    res.status(401).json({
      error: "Authentication required",
      code: "AUTH_MISSING",
    });
    return;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    emitAuditEvent({ action: "auth.failed", correlationId: req.correlationId, details: { reason: "invalid_format", method: req.method, url: req.url } });
    res.status(401).json({
      error: "Invalid authentication format",
      code: "AUTH_INVALID_FORMAT",
    });
    return;
  }

  const token = parts[1];
  const expected = config.apiToken ?? "";
  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);
  const tokenMatches = tokenBuffer.length === expectedBuffer.length
    && timingSafeEqual(tokenBuffer, expectedBuffer);

  if (!tokenMatches) {
    logger.warn({ method: req.method, url: req.url, correlationId: req.correlationId }, "Auth token invalid");
    emitAuditEvent({ action: "auth.denied", correlationId: req.correlationId, details: { reason: "invalid_token", method: req.method, url: req.url } });
    res.status(403).json({
      error: "Forbidden",
      code: "AUTH_FORBIDDEN",
    });
    return;
  }

  next();
}
