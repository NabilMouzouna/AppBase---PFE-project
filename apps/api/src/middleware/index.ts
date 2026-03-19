import type { FastifyInstance } from "fastify";
import { registerErrorHandler } from "./error-handler";
import { registerNotFoundHandler } from "./not-found";
import { apiKeyMiddleware } from "./api-key";
import { jwtVerifyMiddleware } from "./jwt-verify";

export function registerMiddleware(app: FastifyInstance) {
  app.addHook("onRequest", apiKeyMiddleware);
  app.addHook("preHandler", jwtVerifyMiddleware);
  registerNotFoundHandler(app);
  registerErrorHandler(app);
}
