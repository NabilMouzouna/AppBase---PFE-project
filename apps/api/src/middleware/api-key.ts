import type { FastifyRequest, FastifyReply } from "fastify";

function isExcluded(method: string, path: string): boolean {
  const p = path.split("?")[0] ?? "/";
  if (p.startsWith("/api/auth/")) return true;
  if (method === "POST" && (p === "/auth/register" || p === "/auth/login" || p === "/auth/refresh" || p === "/auth/logout")) return true;
  if (method === "GET" && (p === "/health" || p.startsWith("/docs"))) return true;
  return false;
}

export async function apiKeyMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (isExcluded(request.method, request.url?.split("?")[0] ?? "/")) {
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
