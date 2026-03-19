import type { FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./health";
import { registerAuthRoutes } from "./auth";

export async function registerRoutes(app: FastifyInstance) {
  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
}
