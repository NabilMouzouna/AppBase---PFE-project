import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Auth } from "../lib/auth";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { auditLog } from "@appbase/db/schema";

const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  customIdentity: z.record(z.string(), z.string()).optional(),
});

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const EXPIRES_IN_SECONDS = 900; // 15 minutes

// OpenAPI schemas for /docs
const apiErrorSchema = {
  type: "object",
  properties: {
    success: { type: "boolean", const: false },
    error: {
      type: "object",
      properties: { code: { type: "string" }, message: { type: "string" } },
      required: ["code", "message"],
    },
  },
  required: ["success", "error"],
} as const;

const userSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    email: { type: "string", format: "email" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: ["id", "email", "createdAt", "updatedAt"],
} as const;

const registerSchema = {
  tags: ["auth"],
  summary: "Register",
  description: "Create a new user account and return access/refresh tokens.",
  body: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email: { type: "string", format: "email" },
      password: { type: "string", minLength: 1 },
      customIdentity: { type: "object", additionalProperties: { type: "string" } },
    },
  },
  response: {
    201: {
      type: "object",
      properties: {
        success: { type: "boolean", const: true },
        data: {
          type: "object",
          properties: {
            accessToken: { type: "string" },
            refreshToken: { type: "string" },
            expiresIn: { type: "number" },
            user: userSchema,
          },
          required: ["accessToken", "refreshToken", "expiresIn", "user"],
        },
      },
      required: ["success", "data"],
    },
    400: apiErrorSchema,
    409: apiErrorSchema,
    500: apiErrorSchema,
  },
} as const;

const loginSchema = {
  tags: ["auth"],
  summary: "Login",
  description: "Sign in with email and password. Returns access and refresh tokens.",
  body: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email: { type: "string", format: "email" },
      password: { type: "string", minLength: 1 },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean", const: true },
        data: {
          type: "object",
          properties: {
            accessToken: { type: "string" },
            refreshToken: { type: "string" },
            expiresIn: { type: "number" },
            user: userSchema,
          },
          required: ["accessToken", "refreshToken", "expiresIn", "user"],
        },
      },
      required: ["success", "data"],
    },
    400: apiErrorSchema,
    401: apiErrorSchema,
    500: apiErrorSchema,
  },
} as const;

const refreshSchema = {
  tags: ["auth"],
  summary: "Refresh token",
  description: "Exchange a refresh token for a new access token. Send the refresh token in the Authorization header.",
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean", const: true },
        data: {
          type: "object",
          properties: {
            accessToken: { type: "string" },
            expiresIn: { type: "number" },
          },
          required: ["accessToken", "expiresIn"],
        },
      },
      required: ["success", "data"],
    },
    401: apiErrorSchema,
  },
} as const;

const logoutSchema = {
  tags: ["auth"],
  summary: "Logout",
  description: "Invalidate the current session. Optionally send refresh token in Authorization header.",
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean", const: true },
        data: {
          type: "object",
          properties: { loggedOut: { type: "boolean", const: true } },
          required: ["loggedOut"],
        },
      },
      required: ["success", "data"],
    },
  },
} as const;

function apiSuccess<T>(data: T) {
  return { success: true as const, data };
}

function apiError(code: string, message: string) {
  return { success: false as const, error: { code, message } };
}

function formatUser(user: { id: string; email: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
    updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : user.updatedAt,
  };
}

async function getJwtFromSession(
  auth: Auth,
  sessionToken: string,
  baseUrl: string,
): Promise<string | null> {
  const url = `${baseUrl}/api/auth/token`;
  const req = new Request(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  const res = await auth.handler(req);
  if (!res.ok) return null;
  const json = (await res.json()) as { token?: string };
  return json.token ?? null;
}

export async function registerAuthRoutes(app: FastifyInstance) {
  const { auth } = app;
  const baseUrl = app.config.BASE_URL;

  // Mount better-auth internal routes at /api/auth/*
  app.all("/api/auth/*", async (request: FastifyRequest, reply: FastifyReply) => {
    const url = `${baseUrl}${request.url}`;
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(request.headers)) {
      if (v != null && typeof v === "string") headers[k] = v;
      else if (Array.isArray(v)) headers[k] = v.join(", ");
    }
    const hasBody = !["GET", "HEAD"].includes(request.method) && request.body != null;
    const req = new Request(url, {
      method: request.method,
      headers,
      body: hasBody ? JSON.stringify(request.body) : undefined,
    });
    const res = await auth.handler(req);
    const resHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      resHeaders[k] = v;
    });
    reply.status(res.status).headers(resHeaders);
    const text = await res.text();
    if (text) {
      try {
        reply.send(JSON.parse(text));
      } catch {
        reply.send(text);
      }
    } else {
      reply.send();
    }
  });

  // POST /auth/register
  app.post<{ Body: unknown }>("/auth/register", { schema: registerSchema }, async (request, reply) => {
    const parsed = registerBodySchema.safeParse(request.body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e: { message: string }) => e.message).join("; ");
      return reply.status(400).send(apiError("VALIDATION_ERROR", msg));
    }
    const { email, password, customIdentity } = parsed.data;

    try {
      await auth.api.signUpEmail({
        body: {
          email,
          password,
          name: "",
          metadata: customIdentity ? JSON.stringify(customIdentity) : "{}",
        },
      });
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "";
      if (msg.includes("already") || msg.includes("exists") || msg.includes("unique")) {
        return reply.status(409).send(apiError("CONFLICT", "A user with this email already exists."));
      }
      return reply.status(400).send(apiError("VALIDATION_ERROR", msg || "Invalid request"));
    }

    let session: { token: string; user: { id: string; email: string; createdAt: Date; updatedAt: Date } };
    try {
      session = await auth.api.signInEmail({
        body: { email, password },
      }) as typeof session;
    } catch {
      return reply.status(500).send(apiError("INTERNAL_ERROR", "Failed to sign in after registration"));
    }

    const jwt = await getJwtFromSession(auth, session.token, baseUrl);
    if (!jwt) {
      return reply.status(500).send(apiError("INTERNAL_ERROR", "Failed to obtain access token"));
    }

    // Audit log
    const now = new Date();
    await app.db.insert(auditLog).values({
      id: randomUUID(),
      action: "user.register",
      userId: session.user.id,
      resource: "users",
      resourceId: session.user.id,
      metadata: {},
      createdAt: now,
    });

    return reply.status(201).send(
      apiSuccess({
        accessToken: jwt,
        refreshToken: session.token,
        expiresIn: EXPIRES_IN_SECONDS,
        user: formatUser(session.user),
      }),
    );
  });

  // POST /auth/login
  app.post<{ Body: unknown }>("/auth/login", { schema: loginSchema }, async (request, reply) => {
    const parsed = loginBodySchema.safeParse(request.body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e: { message: string }) => e.message).join("; ");
      return reply.status(400).send(apiError("VALIDATION_ERROR", msg));
    }
    const { email, password } = parsed.data;

    let session: { token: string; user: { id: string; email: string; createdAt: Date; updatedAt: Date } };
    try {
      session = await auth.api.signInEmail({
        body: { email, password },
      }) as typeof session;
    } catch {
      return reply.status(401).send(apiError("INVALID_CREDENTIALS", "Invalid email or password."));
    }

    const jwt = await getJwtFromSession(auth, session.token, baseUrl);
    if (!jwt) {
      return reply.status(500).send(apiError("INTERNAL_ERROR", "Failed to obtain access token"));
    }

    // Audit log
    const now = new Date();
    await app.db.insert(auditLog).values({
      id: randomUUID(),
      action: "user.login",
      userId: session.user.id,
      resource: "users",
      resourceId: session.user.id,
      metadata: {},
      createdAt: now,
    });

    return reply.send(
      apiSuccess({
        accessToken: jwt,
        refreshToken: session.token,
        expiresIn: EXPIRES_IN_SECONDS,
        user: formatUser(session.user),
      }),
    );
  });

  // POST /auth/refresh
  app.post("/auth/refresh", { schema: refreshSchema }, async (request, reply) => {
    const authHeader = request.headers.authorization;
    const sessionToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!sessionToken) {
      return reply.status(401).send(apiError("INVALID_TOKEN", "The provided token is invalid or expired."));
    }

    const jwt = await getJwtFromSession(auth, sessionToken, baseUrl);
    if (!jwt) {
      return reply.status(401).send(apiError("INVALID_TOKEN", "The provided token is invalid or expired."));
    }

    return reply.send(
      apiSuccess({
        accessToken: jwt,
        expiresIn: EXPIRES_IN_SECONDS,
      }),
    );
  });

  // POST /auth/logout
  app.post("/auth/logout", { schema: logoutSchema }, async (request, reply) => {
    const authHeader = request.headers.authorization;
    const sessionToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!sessionToken) {
      return reply.send(apiSuccess({ loggedOut: true }));
    }

    const url = `${baseUrl}/api/auth/sign-out`;
    const req = new Request(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    await auth.handler(req);

    return reply.send(apiSuccess({ loggedOut: true }));
  });
}
