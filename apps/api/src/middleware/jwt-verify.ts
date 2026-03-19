import type { FastifyRequest, FastifyReply } from "fastify";
import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Paths that require JWT verification (Authorization: Bearer <access-token>).
 * Excludes /auth/refresh and /auth/logout which use session token.
 */
const JWT_PROTECTED_PREFIXES = ["/storage/", "/db/"];

function requiresJwt(method: string, path: string): boolean {
  const p = path.split("?")[0] ?? "";
  return JWT_PROTECTED_PREFIXES.some((prefix) => p.startsWith(prefix));
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(baseUrl: string) {
  let jwks = jwksCache.get(baseUrl);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${baseUrl}/api/auth/jwks`));
    jwksCache.set(baseUrl, jwks);
  }
  return jwks;
}

export async function jwtVerifyMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!requiresJwt(request.method, request.url)) {
    return;
  }

  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return reply.status(401).send({
      success: false,
      error: { code: "INVALID_TOKEN", message: "The provided token is invalid or expired." },
    });
  }

  try {
    const baseUrl = request.server.config.BASE_URL;
    const jwks = getJwks(baseUrl);
    const { payload } = await jwtVerify(token, jwks);
    const sub = payload.sub as string | undefined;
    const appId = payload.appId as string | undefined;
    if (!sub) {
      return reply.status(401).send({
        success: false,
        error: { code: "INVALID_TOKEN", message: "The provided token is invalid or expired." },
      });
    }
    (request as FastifyRequest & { userId?: string; appId?: string }).userId = sub;
    (request as FastifyRequest & { userId?: string; appId?: string }).appId = appId;
  } catch {
    return reply.status(401).send({
      success: false,
      error: { code: "INVALID_TOKEN", message: "The provided token is invalid or expired." },
    });
  }
}
