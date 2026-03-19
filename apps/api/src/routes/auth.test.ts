import { describe, expect, it, beforeEach } from "vitest";

import { buildApp } from "../app";
import { loadEnv } from "../config/env";

describe("auth routes", () => {
  const testEnv = loadEnv({
    ...process.env,
    NODE_ENV: "test",
    DB_PATH: ":memory:",
    AUTH_SECRET: "test-secret-must-be-at-least-32-characters-long",
    BASE_URL: "http://localhost:3000",
  });

  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp({ env: testEnv });
  });

  it("POST /auth/register - success", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "test@example.com", password: "SecurePassword123!" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: 900,
      user: {
        id: expect.any(String),
        email: "test@example.com",
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });
  });

  it("POST /auth/register - conflict (duplicate email)", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "dup@example.com", password: "SecurePassword123!" },
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "dup@example.com", password: "OtherSecure456!" },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toContain("already exists");
  });

  it("POST /auth/register - validation error (missing email)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { password: "password123" },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /auth/register - validation error (missing password)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "test@example.com" } as object,
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /auth/login - success", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "login@example.com", password: "SecurePassword123!" },
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "login@example.com", password: "SecurePassword123!" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: 900,
      user: { email: "login@example.com" },
    });
  });

  it("POST /auth/login - invalid credentials", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "nonexistent@example.com", password: "wrong" },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("POST /auth/refresh - success", async () => {
    const registerRes = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "refresh@example.com", password: "SecurePassword123!" },
    });
    const { refreshToken } = registerRes.json().data;

    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: { Authorization: `Bearer ${refreshToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      accessToken: expect.any(String),
      expiresIn: 900,
    });
  });

  it("POST /auth/refresh - invalid/missing token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: { Authorization: "Bearer invalid-token" },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(["INVALID_TOKEN", "INVALID_API_KEY"]).toContain(body.error.code);
  });

  it("POST /auth/logout - success", async () => {
    const registerRes = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "logout@example.com", password: "SecurePassword123!" },
    });
    const { refreshToken } = registerRes.json().data;

    const res = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: { Authorization: `Bearer ${refreshToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.loggedOut).toBe(true);
  });

  it("POST /auth/logout - idempotent when no session", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: { Authorization: "Bearer invalid-or-expired-token" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.loggedOut).toBe(true);
  });
});
