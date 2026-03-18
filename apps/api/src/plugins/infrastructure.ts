import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../config/env";

export async function registerInfrastructure(app: FastifyInstance, env: AppEnv) {
  await app.register(cors, { origin: true });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "AppBase API",
        version: "0.1.0",
      },
      servers: [{ url: env.BASE_URL }],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer" },
          apiKey: { type: "apiKey", in: "header", name: "x-api-key" },
        },
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });
}
