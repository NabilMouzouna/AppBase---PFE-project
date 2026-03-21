import type { FastifyRequest, FastifyReply } from "fastify";

function isExcluded(
  method: string,
  path: string,
  nodeEnv: string,
): boolean {
  const p = path.split("?")[0] ?? "/";
  if (method === "GET" && (p === "/health" || p.startsWith("/docs"))) return true;
  // In test: auth is public so tests can run without seeding API keys
  if (nodeEnv === "test" && method === "POST" && ["/auth/register", "/auth/login", "/auth/refresh", "/auth/logout"].includes(p)) return true;
  if (nodeEnv === "test" && p.startsWith("/api/auth/")) return true;
  return false;
}

export async function apiKeyMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const path = request.url?.split("?")[0] ?? "/";
  if (isExcluded(request.method, path, request.server.config.NODE_ENV)) {
    return;
  }

  const apiKeyHeader = request.headers["x-api-key"];
  if (!apiKeyHeader || typeof apiKeyHeader !== "string") {
    return reply.status(401).send({
      success: false,
      error: { code: "INVALID_API_KEY", message: "Missing or invalid API key." },
    });
  }

  try {
    const result = await request.server.auth.api.verifyApiKey({
      body: { key: apiKeyHeader },
    });
    if (!result.valid) {
      return reply.status(401).send({
        success: false,
        error: { code: "INVALID_API_KEY", message: "Invalid API key." },
      });
    }
    if (result.key) {
      request.apiKey = result.key;
    }
  } catch {
    return reply.status(401).send({
      success: false,
      error: { code: "INVALID_API_KEY", message: "Invalid API key." },
    });
  }
}
