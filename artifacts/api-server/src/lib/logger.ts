import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

const rawLogLevel = process.env.LOG_LEVEL ?? "info";
const logLevel = rawLogLevel.includes("=")
  ? rawLogLevel.split("=").pop()!.trim()
  : rawLogLevel.trim();

export const logger = pino({
  level: logLevel,
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
