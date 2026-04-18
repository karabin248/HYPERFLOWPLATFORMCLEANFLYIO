import { type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger";

const API_TOKEN = process.env.API_TOKEN;
const IS_DEV =
  process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

if (!API_TOKEN) {
  if (!IS_DEV) {
    logger.fatal(
      "API_TOKEN is not set — refusing to start (set NODE_ENV=development to bypass)",
    );
    process.exit(1);
  } else {
    logger.warn(
      "API_TOKEN is not set — running in open dev mode (all requests allowed)",
    );
  }
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
