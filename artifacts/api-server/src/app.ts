import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { fileURLToPath } from "url";
import path from "path";
import healthRouter from "./routes/health";
import protectedRouter from "./routes";
import { requireApiToken } from "./middlewares/auth";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", healthRouter);

app.use("/api", requireApiToken, protectedRouter);

// --- Static frontend serving ---
// IMPORTANT: Register any future server-side routes (e.g. /webhooks, /oauth)
// BEFORE this block, or the SPA catch-all will intercept them.
//
// Auth note: the static files (HTML/JS/CSS) are intentionally public — the UI
// shell contains no sensitive data. All data the UI reads/writes goes through
// /api/* routes above, which are fully protected by requireApiToken.
// To protect the page load itself, a separate cookie-based auth layer is needed.
//
// PUBLIC_DIR at runtime: this file is bundled into dist/index.mjs, so
//   dirname(import.meta.url) = /app/dist  →  ../public = /app/public
const PUBLIC_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
);

app.use(express.static(PUBLIC_DIR));

// SPA fallback — scoped to non-/api routes so API paths are never masked.
// GET /dashboard    → index.html  ✓
// GET /api/unknown  → falls through to Express 404  ✓
// Note: Express 5 requires a named wildcard; "/{*path}" is the correct form.
app.get("/{*path}", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

export default app;
