import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { getConfig } from "./lib/config";
import { correlationMiddleware } from "./middlewares/correlation";
import { requireAuth } from "./middlewares/auth";
import { rateLimiter, bodyLimitGuard } from "./middlewares/rateLimiter";
import { metrics } from "./lib/metrics";
import { classifyError } from "./lib/errorClassifier";

const config = getConfig();

const app: Express = express();

// Determine trust proxy setting from environment.  When TRUST_PROXY=1 the app
// trusts the first X-Forwarded-For header (suitable behind a reverse proxy).
// When TRUST_PROXY=0 or unset the app falls back to the socket's remoteAddress.
const trustProxyEnv = process.env.TRUST_PROXY ?? "0";
const trustProxy = trustProxyEnv === "1";
app.set("trust proxy", trustProxy ? 1 : false);
if (trustProxy) {
  logger.info("trust proxy=1: ensure a reverse proxy is enforcing X-Forwarded-For in production");
} else {
  logger.info("trust proxy disabled; Express will not trust X-Forwarded-For");
}

if (config.hardenedMode && !process.env.CORS_ORIGIN) {
  logger.warn("CORS_ORIGIN is not set while HARDENED_MODE=true; browser clients will be blocked by CORS");
}

app.use(correlationMiddleware);

app.use(
  pinoHttp({
    logger,
    genReqId: (req) => (req as Request).correlationId,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
          correlationId: req.raw?.headers?.["x-correlation-id"],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    metrics.recordRequest(req.method, res.statusCode, Date.now() - start);
  });
  next();
});

app.use(cors({
  origin: config.hardenedMode ? (process.env.CORS_ORIGIN || false) : true,
  credentials: true,
}));

app.use(bodyLimitGuard);
app.use(express.json({ limit: `${config.bodyLimitBytes}` }));
app.use(express.urlencoded({ extended: true }));

app.use(rateLimiter("default"));

app.use("/api", router);

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const correlationId = req.correlationId;

  if (err.message?.includes("entity too large") || err.message?.includes("PayloadTooLargeError")) {
    logger.warn({ correlationId, method: req.method, url: req.url }, "Payload too large");
    res.status(413).json({
      error: "Payload too large",
      code: "PAYLOAD_TOO_LARGE",
      category: "payload_too_large",
      retryable: false,
      correlationId,
    });
    return;
  }

  const classified = classifyError(err);
  logger.error(
    { err, correlationId, method: req.method, url: req.url, category: classified.category },
    "Unhandled error",
  );

  res.status(classified.statusCode).json({
    error: classified.message,
    code: classified.code,
    category: classified.category,
    retryable: classified.retryable,
    correlationId,
  });
});

export { requireAuth, rateLimiter };
export default app;
