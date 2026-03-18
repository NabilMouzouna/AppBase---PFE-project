import type { FastifyInstance } from "fastify";
import { registerErrorHandler } from "./error-handler";
import { registerNotFoundHandler } from "./not-found";

export function registerMiddleware(app: FastifyInstance) {
  registerNotFoundHandler(app);
  registerErrorHandler(app);
}
