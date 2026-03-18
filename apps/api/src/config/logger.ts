import type { LoggerOptions } from "pino";
import type { AppEnv } from "./env";

export function createLoggerConfig(env: AppEnv): LoggerOptions {
  return {
    name: "appbase-api",
    level: env.LOG_LEVEL,
    base: {
      service: "appbase-api",
      environment: env.NODE_ENV,
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.x-api-key",
        "headers.authorization",
        "headers.x-api-key",
      ],
      censor: "[REDACTED]",
    },
  };
}
