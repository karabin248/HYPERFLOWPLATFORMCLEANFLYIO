import { type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger";

const API_TOKEN = process.env.API_TOKEN;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

if (!API_TOKEN) {
  if (IS_PRODUCTION) {
    logger.fatal("API_TOKEN is not set in production — refusing to start");
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
