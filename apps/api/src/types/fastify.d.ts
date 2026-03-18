import type { AppDb } from "@appbase/db";
import type { AppEnv } from "../config/env";

declare module "fastify" {
  interface FastifyInstance {
    db: AppDb;
    config: AppEnv;
  }
}

export {};
