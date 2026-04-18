import { type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger";

const API_TOKEN = process.env.API_TOKEN;

if (!API_TOKEN) {
  logger.warn("API_TOKEN is not set — all requests will be allowed (dev mode)");
}

export function requireApiToken(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!API_TOKEN) {
    next();
    return;
  }

  const authHeader = req.headers["authorization"] ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token || token !== API_TOKEN) {
    res.status(401).json({ status: "error", error: "Unauthorized" });
    return;
  }

  next();
}
