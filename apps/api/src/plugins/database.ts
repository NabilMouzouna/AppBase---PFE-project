import { createDb } from "@appbase/db";
import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../config/env";
import { ensureParentDirectory } from "../utils/filesystem";

export async function registerDatabase(app: FastifyInstance, env: AppEnv) {
  ensureParentDirectory(env.DB_PATH);
  app.decorate("db", createDb(env.DB_PATH));
}
