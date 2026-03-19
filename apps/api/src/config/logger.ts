import type { LoggerOptions } from "pino";
import type { AppEnv } from "./env";

export function createLoggerConfig(env: AppEnv): LoggerOptions {
  const base: LoggerOptions = {
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

  if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
    return {
      ...base,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss",
          ignore: "pid,hostname",
        },
      },
    };
  }

  return base;
}
