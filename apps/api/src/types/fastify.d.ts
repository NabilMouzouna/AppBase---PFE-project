import type { AppDb } from "@appbase/db";
import type { AppEnv } from "../config/env";
import type { Auth } from "../lib/auth";

declare module "fastify" {
  interface FastifyInstance {
    db: AppDb;
    config: AppEnv;
    auth: Auth;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    apiKey?: { id: string; [key: string]: unknown };
    userId?: string;
    appId?: string;
  }
}

export {};
