# ADR-003 — Auth Implementation Strategy

**Status:** Accepted (amended 2026-03-17)  
**Date:** 2026-03-17  
**Deciders:** AppBase core team  
**Tags:** `backend`, `auth`, `security`, `api-keys`

---

## Context

AppBase provides authentication as a service. The auth system has three distinct concerns that must be addressed:

| Concern | Actors | Mechanism |
|---|---|---|
| **End-user auth** | Users of apps built on AppBase — interact via `/auth/*` API | Subject of this ADR |
| **API key auth** | App containers authenticating requests to AppBase services | Bearer key in `Authorization` header, validated in Fastify `preHandler` |
| **Admin dashboard auth** | The sysadmin operating the AppBase instance | Same JWT mechanism as end-user auth |

The SDK contract is defined in the README:

> *"store and refresh tokens automatically, inject the ID token into every storage/db request header, and manage the SSE subscription lifecycle"*

This establishes that token delivery is header-based (not cookie-based), that tokens are managed client-side by the SDK, and that silent refresh is a first-class SDK responsibility. The `/auth/refresh` endpoint already appears in the MVP API surface.

The auth system must work entirely offline — no external identity provider, no network call outside the LAN. All cryptographic operations are local.

---

## Decisions

1. **Auth method:** Email + password only — no OAuth providers, no magic links, no 2FA for MVP
2. **Token strategy:** Cognito-style 3-token model — ID token + short-lived JWT access token + opaque refresh token (session) persisted in the database
3. **Password reset:** Admin-mediated via the admin dashboard — no SMTP, no email sending
4. **Implementation library:** `better-auth` — handles the full token lifecycle, session management, and API key management without building from scratch
5. **Identity model:** Core identity (email) + flexible `customIdentity: Record<string, string>` stored as a `metadata` JSON field on the user record — separates identity from business data
6. **Password hashing:** argon2id (configured via better-auth)
7. **API key format:** `hs_live_` prefix via `@better-auth/api-key` plugin
8. **JWT signing algorithm:** EdDSA (Ed25519) — asymmetric, JWKS-based verification

---

## Implementation Library

### Why not build from scratch

The token strategy described below is correct regardless of whether the implementation is hand-rolled or uses a library. The question is how much of the token lifecycle — session storage, password hashing, key rotation, JWKS management, token refresh — is undifferentiated infrastructure work.

Building the hybrid token model from scratch requires implementing:
- Secure session token generation and storage
- argon2id hashing with safe defaults
- JWT signing and JWKS key management
- Token refresh with rotation and reuse detection
- API key generation, hashing, and validation
- Password reset token generation and expiry

None of this is AppBase's core value. It's infrastructure plumbing that a library can own.

### better-auth

`better-auth` is a TypeScript-first, self-hosted authentication framework with a Drizzle adapter, `better-sqlite3` support, and a plugin system. It has **no external service dependencies** — all operations are in-process and fully offline-compatible.

| better-auth feature | AppBase application |
|---|---|
| `emailAndPassword` plugin | `/auth/register`, `/auth/login` — email/password auth |
| `bearer` plugin | Allows `Authorization: Bearer <session-token>` in lieu of cookies — required for SDK header-based usage |
| `jwt` plugin | Issues a short-lived JWT (15 min, EdDSA-signed) from an active session. Exposed via `GET /api/auth/token`. Sets `set-auth-jwt` header on `getSession` |
| JWKS endpoint (`/api/auth/jwks`) | Public key distribution for in-process JWT verification |
| `@better-auth/api-key` plugin | Manages `hs_live_` prefixed API keys — generation, hashing, verification, expiry, rate limiting |
| `@better-auth/drizzle-adapter` | Integrates with the existing `packages/db` Drizzle instance |
| argon2id via configuration | Password hashing with configurable parameters |
| Session revocation | `revokeSession`, `revokeOtherSessions`, `revokeSessions` — full revocation surface |

**Offline compatibility:** `better-auth` makes zero network calls. The JWT `issuer` and `audience` are set to the AppBase `BASE_URL` (e.g. `http://localhost:3000` in M1, `http://app-name.appbase.local` in M3+). JWKS verification is local. No external IdP, no cloud dependency.

### Plugin configuration

```typescript
import { betterAuth } from 'better-auth'
import { bearer, jwt, admin } from 'better-auth/plugins'
import { apiKey } from '@better-auth/api-key'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@appbase/db'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'sqlite' }),
  baseURL: process.env.BASE_URL,
  secret: process.env.AUTH_SECRET,

  emailAndPassword: {
    enabled: true,
    // Password reset is admin-mediated — no email sending configured
  },

  user: {
    additionalFields: {
      // Flexible identity fields: phone, fullName, or any key-value pairs
      // the app developer wants to associate with the user identity.
      // Stored as JSON text, parsed at read time.
      metadata: {
        type: 'string',
        required: false,
        input: true,          // accepted at sign-up and updateUser
        defaultValue: '{}',
      },
      // App namespace — populated by AppBase, not by the user.
      // Critical for M2 multi-app isolation.
      appId: {
        type: 'string',
        required: false,
        input: false,
      },
    },
  },

  plugins: [
    bearer(),   // Authorization: Bearer <session-token> for SDK (no cookies)

    jwt({
      jwt: {
        expirationTime: '15m',
        definePayload: ({ user }) => ({
          sub:      user.id,
          email:    user.email,
          appId:    user.appId,
          metadata: user.metadata,  // customIdentity available in JWT for SDK
        }),
      },
    }),

    admin(),    // setUserPassword, listUsers, banUser — admin dashboard surface

    apiKey({
      defaultPrefix: 'hs_live_',
      schema: { apiKey: { tableName: 'api_keys' } },
    }),
  ],
})
```

### Fastify integration

better-auth exposes a standard `fetch`-compatible handler. Fastify receives requests and bridges them:

```typescript
// apps/api/src/plugins/auth.ts
fastify.all('/api/auth/*', async (request, reply) => {
  const response = await auth.handler(request.raw)
  reply.send(response)
})

// Fastify preHandler — validates JWT on protected routes
fastify.addHook('preHandler', async (request, reply) => {
  const token = request.headers.authorization?.replace('Bearer ', '')
  if (!token) throw reply.code(401).send()
  const session = await auth.api.getSession({ headers: request.headers as any })
  if (!session) throw reply.code(401).send()
  request.userId = session.user.id
  request.appId  = session.user.appId
})
```

---

## Identity Model

### Scope: email + password only

AppBase's MVP auth method is email + password. No OAuth providers, no passkeys, no magic links. This is a deliberate scope constraint — the target users (clinics, schools, local gov) operate in controlled environments where email/password is the appropriate and expected mechanism.

### customIdentity — flexible key-value identity fields

AppBase exposes a `customIdentity` field at registration and user update. This accepts any `Record<string, string>` the consuming application wants to associate with the user's identity — phone number, full name, employee ID, department, or any other domain-specific identity attribute.

**Why this exists as a first-class API field:**

The identity record (who the user is) belongs with auth, not scattered across the application's business data. Without `customIdentity`, application developers would store identity-adjacent data (e.g. `fullName`, `phone`) in their own `records` collection, mixing identity with business data. AppBase avoids this by providing a dedicated identity metadata slot on the user object itself.

**Storage:** `metadata TEXT` column on the `user` table (JSON-serialized). Stored and returned as-is — AppBase does not interpret or validate the keys within it.

**Registration:**
```typescript
// SDK — client side
await client.auth.signUp({
  email: 'user@clinic.local',
  password: 'secret123',
  customIdentity: {
    fullName: 'Amina Berrada',
    phone:    '+212 6xx xxx xxx',
    staffId:  'MED-0042',
  },
})

// better-auth maps `customIdentity` → `metadata` (JSON.stringify) internally
// The SDK layer handles this translation
```

**JWT payload:** The `metadata` field is included in the JWT via `definePayload`. The SDK can access `customIdentity` from the decoded token without an additional API call — `client.auth.currentUser()` returns the full identity including custom fields.

**Update:** `authClient.updateUser({ metadata: JSON.stringify(updatedIdentity) })` — replaces the metadata blob. The SDK wraps this as `client.auth.updateIdentity({ phone: '...' })`.

### Admin-mediated password reset (no SMTP)

AppBase operates on a LAN with no external email service. The `/auth/reset-password` flow in the MVP API surface is replaced by an admin-mediated mechanism:

1. A user reports they cannot log in
2. The admin opens the AppBase dashboard → Users → select user
3. Admin calls `auth.api.setUserPassword({ body: { userId, newPassword } })` — server-only, no token, no email
4. Admin communicates the temporary password to the user out-of-band (in-person, phone, internal chat)
5. User logs in and is prompted to change their password

`auth.api.setUserPassword` is provided by better-auth's `admin` plugin. It bypasses the standard password change flow (which requires the current password) and is available only to users with the `admin` role.

**The `/auth/reset-password` endpoint is deferred from MVP.** If a self-service reset flow is added in a future milestone, better-auth supports it via a `sendResetPassword` callback — which can be wired to an internal notification system rather than SMTP.

### Identity record vs. business records

```
user table (identity)
├── id
├── email
├── role
├── metadata  ← { fullName, phone, staffId, ... }  ← customIdentity lives here
├── appId
└── createdAt

records table (business data)
├── id
├── collection
├── appId
├── data      ← { site, username, encrypted }  ← app business logic lives here
├── createdAt
└── updatedAt
```

The `user` table is AppBase's responsibility. The `records` table is the application developer's responsibility. `customIdentity` ensures identity-adjacent data never leaks into `records`.

---

## Token Strategy

### Option 1 — Pure Session-Based (server-side sessions)

Server stores session state in the database. Client receives a session ID (typically in a cookie) and presents it on every request, triggering a DB lookup.

**Strengths:**
- Trivial revocation — delete the row, the session is dead
- Simple to reason about

**Weaknesses:**
- Every authenticated request hits the database for identity validation. AppBase serves as a platform layer for multiple apps and their users — this is the highest-frequency code path. A DB round-trip on every request is a meaningful overhead on commodity hardware.
- The SDK injects tokens into request headers, not cookies. Managing cookies across SDK runtimes (browser, Node.js, potential mobile clients) adds complexity where none is needed.
- SSE connections (`/collections/:collection/subscribe`) require a persistent authenticated channel. Session cookies are awkward to inject and re-validate across a long-lived HTTP stream.
- Logout across all devices requires querying and deleting every session for the user — structurally the same as the refresh token model, but with more frequent DB pressure.

**Assessment:** Eliminated. DB-per-request overhead on the hot path is incompatible with a platform layer. The cookie-based delivery model does not match the SDK's header-injection contract.

---

### Option 2 — Stateless JWT (access token only)

Server issues a signed JWT. Verification is a cryptographic operation — no DB lookup.

**Strengths:**
- Zero DB cost on the hot path — verify the signature, extract claims, proceed
- Simple: one token, one endpoint, one secret

**Weaknesses:**
- **Logout is client-side only.** `POST /auth/logout` clears the client's token but the JWT itself remains valid until expiry. A stolen token cannot be invalidated server-side without a revocation list — which negates the stateless benefit.
- **No "revoke all sessions."** If a user's device is lost or compromised, there is no way to force re-authentication.
- Access tokens must have a long TTL to be usable without a refresh mechanism, expanding the window of exposure for stolen tokens.
- Short TTL without refresh forces users to re-authenticate frequently — unacceptable for a BaaS platform used by applications that manage their own user sessions.

**Assessment:** Eliminated. Logout is a required feature in the MVP API surface. Stateless JWT cannot implement it without server-side state — at which point the hybrid model is strictly better.

---

### Option 3 — Cognito-Style 3-Token Model (selected)

Three distinct tokens with different lifetimes and purposes, mirroring the model used by AWS Cognito, Firebase Auth, and Supabase Auth.

**Token structure:**

```
Refresh token (session):  opaque random string, EdDSA-signed session
  managed by:  better-auth sessions table
  TTL:         7 days, sliding window (renewed on use)
  delivery:    Authorization: Bearer <session-token>  (Bearer plugin)

Access token:  JWT, signed EdDSA (Ed25519)
  payload:     { sub, email, appId, iat, exp }
  TTL:         15 minutes
  endpoint:    GET /api/auth/token  (JWT plugin)
  delivery:    Authorization: Bearer <access-token>

ID token:      Same JWT as the access token for AppBase's use case.
               The JWT payload contains identity claims (sub, email, appId).
               Separating ID and access tokens is an OIDC concern relevant
               when external resource servers verify tokens independently —
               not applicable here since AppBase verifies its own tokens.
```

The ID token and access token are combined into a single JWT. This is the correct simplification for a self-contained BaaS platform: the only resource server is AppBase itself.

**Full auth flow:**

```
POST /api/auth/sign-in/email
  →  { token: sessionToken }  (in response body via Bearer plugin)
  →  set-auth-jwt: <jwt>       (JWT plugin sets this header)
  SDK stores both: sessionToken (7 days) + jwt (15 min)

All Storage/DB requests:
  Authorization: Bearer <jwt>
  Fastify preHandler: verify JWT via JWKS (no DB hit)
  Claims injected into request context: { userId, appId }

GET /api/auth/token  (when JWT expires — SDK calls this automatically)
  Authorization: Bearer <sessionToken>
  →  { token: <new-jwt> }
  SDK replaces stored jwt, retries original request transparently

POST /api/auth/sign-out
  →  deletes session row — device cannot get a new JWT
  →  existing JWT expires naturally within its 15-min window

Revoke all sessions:
  →  auth.api.revokeSessions() — deletes all session rows for user
```

**Session token rotation:**  
better-auth rotates the session token on use when the session's `updateAge` threshold is reached (default: 24 hours). Each rotation issues a new token and invalidates the old. Reuse of an invalidated session token triggers full session revocation for that user.

**SDK behavior (invisible to application developers):**

```typescript
// SDK internals — not visible to the developer using AppBase
class AuthManager {
  private sessionToken: string   // long-lived, stored in memory/localStorage
  private jwt: string            // short-lived, refreshed automatically
  private jwtExpiresAt: number

  async getValidJwt(): Promise<string> {
    if (Date.now() > this.jwtExpiresAt - 30_000) {  // 30s buffer
      const res = await fetch(`${this.endpoint}/api/auth/token`, {
        headers: { Authorization: `Bearer ${this.sessionToken}` }
      })
      this.jwt = (await res.json()).token
      this.jwtExpiresAt = Date.now() + 15 * 60 * 1000
    }
    return this.jwt
  }
}

// Every storage/db request goes through:
headers['Authorization'] = `Bearer ${await auth.getValidJwt()}`
```

**Why this model satisfies all requirements:**

| Requirement | How it is met |
|---|---|
| No DB hit on hot path | JWT signature verified against local JWKS — pure crypto |
| Logout works | Delete session row — device cannot get a new JWT |
| Revoke all sessions | `auth.api.revokeSessions()` deletes all session rows for `userId` |
| SDK silent refresh | SDK calls `GET /api/auth/token` when JWT approaches expiry |
| SSE authentication | SSE handshake validates JWT once; no re-auth during the stream |
| Offline operation | All crypto is local; JWKS served from local `/api/auth/jwks` endpoint |
| 3-token model | sessionToken (refresh) + JWT (access+ID) + API key (app auth) |

**Assessment:** Selected. better-auth implements this model out of the box via the `bearer` + `jwt` plugins. The MVP API surface's `/auth/refresh` maps to `GET /api/auth/token`. No token lifecycle code needs to be hand-rolled.

---

## Password Hashing: argon2id

### bcrypt

bcrypt has been the industry standard since 1999 and remains widely deployed.

**Strengths:**
- Battle-tested, 25+ years of production use
- `bcryptjs` is pure JavaScript — no native compilation required
- Well understood and widely documented

**Weaknesses:**
- **72-byte silent truncation.** bcrypt ignores any password input beyond 72 bytes. A password of 100 characters hashes identically to its first 72 characters. This is a silent footgun — users and developers will not notice until a security audit does. For a platform storing healthcare and school data this is not acceptable.
- CPU-only attack surface. bcrypt is not memory-hard — offline brute-force attacks on a stolen database scale with GPU compute, not GPU memory bandwidth.
- Not the current OWASP first choice.

### argon2id (selected)

argon2id won the Password Hashing Competition in 2015 and is the OWASP-recommended algorithm for new systems.

**Strengths:**
- **Memory-hard** — each hash computation requires a configurable amount of memory. GPU and ASIC attacks are bounded by memory bandwidth, not compute throughput. A stolen database cannot be brute-forced efficiently even with commodity GPU hardware.
- **No input length limit.** Any password length hashes correctly.
- **Three tunable parameters:** `memoryCost` (RAM per hash), `timeCost` (iterations), `parallelism`. These can be increased as hardware improves without changing the algorithm.
- argon2id combines resistance to side-channel attacks (argon2i) and GPU attacks (argon2d) — the hybrid is recommended for most applications.

**Weaknesses:**
- `argon2` npm package requires native bindings — compiled during `npm install` / `docker build`. This is a one-time build cost, not a runtime concern.

**Parameters for AppBase (commodity hardware baseline):**

```typescript
import argon2 from 'argon2'

const HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,   // 64 MB
  timeCost: 3,         // 3 iterations
  parallelism: 1,
}

await argon2.hash(password, HASH_OPTIONS)
await argon2.verify(storedHash, incomingPassword)
```

At these parameters, a single hash takes ~100–200ms on a 1-core commodity CPU — acceptable for auth endpoints, prohibitive for offline dictionary attacks.

**Assessment:** argon2id selected. The 72-byte truncation issue in bcrypt is a silent correctness bug that cannot be tolerated in a platform handling sensitive user data.

---

## API Key Design

API key management is handled entirely by the `@better-auth/api-key` plugin. No custom key generation, hashing, or validation logic is required.

### Format

```
hs_live_<random-bytes>
```

The `defaultPrefix: 'hs_live_'` option in the plugin configuration produces keys following the pattern established by Stripe (`sk_live_`), GitHub (`ghp_`), and Vercel (`vercel_`). The prefix makes AppBase keys identifiable in logs, environment files, and source code. Secret scanning tools can be configured to flag this pattern in CI.

The plugin generates cryptographically random bytes for the key body, URL-safe encoded. Keys are returned to the caller **exactly once** at creation time.

### Storage

The `@better-auth/api-key` plugin stores a hash of the key, never the raw value. The hashing strategy and secure comparison are managed by the library. On each request:

```typescript
// Fastify preHandler — API key validation
const apiKeyHeader = request.headers['x-api-key']
if (apiKeyHeader) {
  const result = await auth.api.verifyApiKey({ body: { key: apiKeyHeader } })
  if (!result.valid) throw reply.code(401).send()
  request.appId = result.key.metadata.appId
}
```

SHA-256 is the correct hash function for API keys (not argon2). The 256-bit random key body provides the entropy — the hash only needs collision resistance, not slowness. Using argon2 would add ~150ms latency to every API request for no security gain.

### Key scoping

Each API key is issued with `metadata: { appId }`. All requests carrying that key are scoped to that app's resources. The `appId` extracted from key metadata is injected into the Fastify request context and filters all subsequent storage and database operations.

### Built-in capabilities (from `@better-auth/api-key`)

- Custom prefix (`hs_live_`)
- Expiry timestamps and remaining-request counters
- Built-in rate limiting per key
- Key enable/disable without deletion
- Audit trail (keys retained after revocation)
- Programmatic creation from the admin service: `auth.api.createApiKey({ body: { userId, metadata: { appId } } })`

---

## JWT Signing

**Algorithm:** EdDSA (Ed25519) — asymmetric

better-auth's JWT plugin defaults to EdDSA with the Ed25519 curve. This is the correct choice over HS256 for this use case:

| Property | HS256 (symmetric) | EdDSA / Ed25519 (asymmetric) |
|---|---|---|
| Key type | Single shared secret | Public/private key pair |
| Verification | Requires the secret | Requires only the public key (JWKS) |
| Key rotation | All consumers need the new secret | Rotate private key; distribute new public key via JWKS |
| Signature size | 32 bytes | 64 bytes |
| Speed | Fast | Comparable on modern hardware |

The asymmetric model is preferable because in M2+, each app container verifies JWTs issued by the auth service. With HS256, every container would need a copy of the signing secret — a credentials distribution problem. With EdDSA, each container fetches the public key from the JWKS endpoint once and caches it indefinitely. The private key never leaves the auth process.

**Key management:** better-auth generates the Ed25519 key pair on first startup and stores it in the `jwks` table (private key encrypted with AES-256-GCM). Key rotation is configurable via `rotationInterval`.

**Access token payload:**

```typescript
// Configured via jwt.definePayload in better-auth setup
interface AccessTokenPayload {
  sub:   string   // user ID
  email: string   // identity claim for SDK consumers
  appId: string   // app namespace — M2 multi-app isolation
  iat:   number
  exp:   number   // iat + 900 (15 minutes)
}
```

The `appId` claim is a custom field on the `user` table (added via better-auth schema extension). In M2, each app container verifies that the token's `appId` matches its own identity — a JWT issued by one app container's user namespace cannot be presented to another.

**JWKS endpoint:** `GET /api/auth/jwks` — served by better-auth, cached by Fastify's JWT verification middleware. Public key fetched once per process lifecycle (or on `kid` mismatch).

---

## Consequences

**Positive:**
- The Fastify `preHandler` validates JWTs against the local JWKS endpoint — pure cryptographic check, no DB hit on the hot path
- Full revocation semantics out of the box: `signOut`, `revokeOtherSessions`, `revokeSessions` — no custom session deletion logic
- argon2id parameters are forward-compatible — increasing `memoryCost` or `timeCost` requires only reconfiguration and re-hash on next login
- API key prefix (`hs_live_`) enables secret scanning automation in CI/CD pipelines without custom tooling
- The `appId` claim in JWTs is M2-ready — app containers fetch the JWKS once and verify tokens locally without calling back to the auth service
- EdDSA asymmetric signing means the private key never needs to leave the auth process — each container verifies with the public key only
- The entire token lifecycle (issuance, refresh, rotation, revocation) is owned by better-auth. AppBase code only calls the library's APIs.

**Negative:**
- better-auth is a relatively young library (emerged late 2024). The API has stabilized in v1.x, but fewer production deployments exist compared to Passport.js or Auth0. Mitigated by pinning a specific version and reviewing the changelog before upgrades.
- The `argon2` native dependency requires compilation during `docker build`. Multi-arch builds (`linux/amd64`, `linux/arm64`) must both be verified in CI.
- The SDK must handle JWT refresh failure during network loss on the LAN (not internet loss — but brief LAN interruptions are possible). The SDK needs retry-with-backoff before treating the session as expired.

**Neutral:**
- `/auth/reset-password` is deferred from MVP. Password reset is admin-mediated: `auth.api.setUserPassword` from the admin plugin. A self-service SMTP-based reset can be added in a future milestone by wiring better-auth's `sendResetPassword` callback without changing the token or session architecture.
- better-auth's schema adds tables (`session`, `jwks`, `api_key`) alongside the Drizzle schema in `packages/db`. The `@better-auth/drizzle-adapter` generates these via `npx auth generate`, which outputs Drizzle schema fragments to be merged into the project schema.
- `customIdentity` keys are not validated by AppBase — any `Record<string, string>` is accepted and stored. Schema enforcement at the identity level is the responsibility of the consuming application (validated client-side by the SDK or the app's own logic). AppBase stores it opaquely.

---

## References

- [better-auth Documentation](https://www.better-auth.com/docs)
- [better-auth JWT Plugin](https://www.better-auth.com/docs/plugins/jwt)
- [better-auth Bearer Plugin](https://www.better-auth.com/docs/plugins/bearer)
- [better-auth API Key Plugin](https://www.better-auth.com/docs/plugins/api-key)
- [better-auth Drizzle Adapter](https://www.better-auth.com/docs/adapters/drizzle)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [RFC 7519 — JSON Web Tokens](https://www.rfc-editor.org/rfc/rfc7519)
- [AppBase README — The SDK is Not Optional](../../README.md#the-sdk-is-not-optional)
- [AppBase README — MVP API Surface](../../README.md#mvp-api-surface)
- ADR-001 — API framework selection (Fastify)
- ADR-002 — ORM and migration strategy (Drizzle + SQLite)
