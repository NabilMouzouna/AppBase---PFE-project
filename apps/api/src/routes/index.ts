import type { FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./health";

export async function registerRoutes(app: FastifyInstance) {
  await registerHealthRoutes(app);
}
