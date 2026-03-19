import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  DB_PATH: z.string().min(1).default("data/appbase.sqlite"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  BASE_URL: z.string().url().optional(),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters")
    .optional(),
});

type ParsedEnv = z.output<typeof envSchema>;

export type AppEnv = Omit<ParsedEnv, "BASE_URL" | "AUTH_SECRET"> & {
  BASE_URL: string;
  AUTH_SECRET: string;
};

export function loadEnv(source: NodeJS.ProcessEnv): AppEnv {
  const parsed = envSchema.parse(source);
  const publicHost = parsed.HOST === "0.0.0.0" ? "localhost" : parsed.HOST;

  const authSecret = parsed.AUTH_SECRET;
  if (parsed.NODE_ENV === "production" && (!authSecret || authSecret.length < 32)) {
    throw new Error(
      "AUTH_SECRET is required in production and must be at least 32 characters",
    );
  }

  return {
    ...parsed,
    BASE_URL: parsed.BASE_URL ?? `http://${publicHost}:${parsed.PORT}`,
    AUTH_SECRET: authSecret ?? "dev-secret-min-32-chars-required-for-auth",
  };
}
