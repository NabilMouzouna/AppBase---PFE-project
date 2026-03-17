import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { createDb } from "@appbase/db";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = process.env["DB_PATH"] ?? "data/appbase.sqlite";
const PORT = Number(process.env["PORT"] ?? 3000);
const HOST = process.env["HOST"] ?? "0.0.0.0";
const JWT_SECRET = process.env["JWT_SECRET"] ?? "change-me-in-production";

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = createDb(DB_PATH);

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(jwt, { secret: JWT_SECRET });
await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });
await app.register(swagger, {
  openapi: {
    info: { title: "AppBase API", version: "0.1.0" },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
        apiKey: { type: "apiKey", in: "header", name: "x-api-key" },
      },
    },
  },
});
await app.register(swaggerUi, { routePrefix: "/docs" });

app.decorate("db", db);

app.get("/health", async () => ({ status: "ok" }));

await app.listen({ port: PORT, host: HOST });
