import type { FastifyRequest, FastifyReply } from "fastify";
import {
  API_ERROR_CODES,
  API_ERROR_MESSAGES,
  AUTH_INTERNAL_PATHS,
  DOCS_PATH_PREFIX,
  HEALTH_PATH,
  TEST_EXCLUDED_AUTH_POST_PATHS,
} from "../constants";

function isExcluded(method: string, path: string, nodeEnv: string): boolean {
  const p = path.split("?")[0] ?? "/";
  if (method === "GET" && (p === HEALTH_PATH || p.startsWith(DOCS_PATH_PREFIX))) return true;
  // In test: auth is public so tests can run without seeding API keys
  if (nodeEnv === "test" && method === "POST" && TEST_EXCLUDED_AUTH_POST_PATHS.includes(p))
    return true;
  if (nodeEnv === "test" && p.startsWith(AUTH_INTERNAL_PATHS.apiPrefix)) return true;
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
      error: {
        code: API_ERROR_CODES.INVALID_API_KEY,
        message: API_ERROR_MESSAGES.INVALID_API_KEY_MISSING,
      },
    });
  }

  try {
    const result = await request.server.auth.api.verifyApiKey({
      body: { key: apiKeyHeader },
    });
    if (!result.valid) {
      return reply.status(401).send({
        success: false,
        error: {
          code: API_ERROR_CODES.INVALID_API_KEY,
          message: API_ERROR_MESSAGES.INVALID_API_KEY,
        },
      });
    }
    if (result.key) {
      request.apiKey = result.key;
    }
  } catch {
    return reply.status(401).send({
      success: false,
      error: {
        code: API_ERROR_CODES.INVALID_API_KEY,
        message: API_ERROR_MESSAGES.INVALID_API_KEY,
      },
    });
  }
}
