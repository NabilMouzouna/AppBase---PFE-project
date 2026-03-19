import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../config/env";
import { createAuth } from "../lib/auth";

export async function registerAuth(app: FastifyInstance, env: AppEnv) {
  const auth = createAuth(app.db, env.BASE_URL, env.AUTH_SECRET);
  app.decorate("auth", auth);
}
