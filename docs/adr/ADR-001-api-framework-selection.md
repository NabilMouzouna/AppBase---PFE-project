# ADR-001 — API Framework Selection

**Status:** Accepted  
**Date:** 2026-03-17  
**Deciders:** AppBase core team  
**Tags:** `backend`, `api`, `architecture`

---

## Context

AppBase is a self-hosted Backend-as-a-Service platform targeting LAN environments and private VPCs. The platform exposes a documented REST API surface (Auth, Storage, Database, Admin) consumed by third-party applications via a JS/TS SDK.

The framework must support:

- TypeScript throughout, with typed route handlers and request/response schemas
- A plugin-per-service architecture: Auth, Storage, DB, and Admin as encapsulated, independently-scoped modules within a single process
- Lifecycle hooks (`onRequest` / `preHandler`) for API key validation middleware applied to all protected routes
- File upload handling for the Storage service (`multipart/form-data`)
- Server-Sent Events (SSE) for real-time DB subscriptions (`/collections/:collection/subscribe`)
- Node.js runtime (project uses Turborepo + npm; no split toolchain)
- Deployment on commodity hardware for small organizations — moderate, predictable load

The platform is **self-hosted and LAN-first**. It will never run on the edge, Cloudflare Workers, or any multi-runtime environment.

---

## Decision

**Fastify** is selected as the REST API framework for AppBase.

---

## Options Considered

### Option 1 — Express.js

Express is the most widely deployed Node.js framework. Its flexibility is well-understood.

**Strengths:**
- Largest middleware ecosystem
- Maximum familiarity for Node.js developers
- No opinions imposed on project structure

**Weaknesses:**
- No built-in schema validation — requires AJV or Zod wired manually
- No built-in JSON serialization optimization
- No native plugin encapsulation with scoped hooks — must be simulated with router nesting
- TypeScript support is available but not a first-class design goal
- Actively in maintenance mode; not innovating in the direction this project needs

**Assessment:** Express requires assembling primitives that Fastify ships as first-class features. The flexibility argument applies when ecosystem compatibility is a hard constraint — it is not here. Eliminated.

---

### Option 2 — Fastify

Fastify is a performance-focused Node.js framework built around a plugin system and JSON schema validation.

**Strengths:**

| Feature | AppBase Application |
|---|---|
| `fastify.register()` with encapsulated scope | Auth, Storage, DB, and Admin as isolated plugins with their own hooks and decorators |
| AJV schema validation on every route | Built-in request validation across all endpoints without an additional library |
| `onRequest` / `preHandler` lifecycle hooks | API key validation middleware scoped precisely to protected routes |
| `@fastify/multipart` plugin | `/storage/buckets/:bucket/upload` file handling |
| `@fastify/jwt` plugin | Auth token signing and verification |
| `fast-json-stringify` serialization | Lower per-response latency on commodity hardware |
| TypeScript generics on route handlers | Typed `request.body`, `request.params`, and `reply` throughout |
| `reply.raw` (Node.js `ServerResponse`) | SSE stream for `/collections/:collection/subscribe` |

The plugin-per-service model in the AppBase MVP architecture is the **canonical Fastify architecture** — not an adaptation of it. Single Fastify process, services registered as plugins, middleware applied via lifecycle hooks.

**Weaknesses:**
- Schema-first route definition adds verbosity compared to minimal frameworks
- Slightly steeper learning curve than Express for developers new to the plugin/hook model

**Assessment:** Every Fastify strength maps to a concrete AppBase requirement. Selected.

---

### Option 3 — Hono

Hono is a modern, lightweight framework with excellent TypeScript inference and cross-runtime portability (Node.js, Deno, Bun, Cloudflare Workers).

**Strengths:**
- TypeScript-first with strong type inference on routes
- Extremely fast on edge runtimes
- Clean, minimal API surface
- Runs on Node.js without Bun

**Weaknesses:**
- The core value proposition is **cross-runtime portability and edge deployment** — neither of which AppBase will ever use. This introduces mental overhead without delivering value.
- Plugin/middleware ecosystem is less mature than Fastify's for server-side concerns (multipart, JWT, schema validation)
- The plugin encapsulation model is less developed than Fastify's scoped `register` system

**Assessment:** Hono solves a problem AppBase does not have. Its strengths are orthogonal to this project's requirements. Eliminated.

---

### Option 4 — Elysia

Elysia is a Bun-optimized framework with end-to-end type safety and excellent DX.

**Strengths:**
- Best-in-class TypeScript inference with end-to-end type propagation
- Extremely high performance benchmarks
- Clean plugin model

**Weaknesses:**
- **Bun-optimized by design.** The performance story depends on Bun's runtime. AppBase uses the npm + Turborepo toolchain throughout.
- Introducing Bun as the runtime for the API service creates a split toolchain: separate lockfile formats, different package manager behavior, CI pipeline divergence, and potential incompatibilities with Turborepo workspace resolution.
- This is a compounding maintenance cost, not a one-time integration effort.

**Assessment:** The runtime dependency on Bun is a structural blocker given the existing Node.js/npm toolchain. Eliminated.

---

## Rationale

The decision is driven by fit, not benchmark rankings. Fastify is chosen because:

1. **The plugin-per-service architecture in the MVP is natively supported** — `fastify.register()` with encapsulated scopes is exactly the model described in the README. No adapter layer, no workaround.

2. **Built-in schema validation eliminates an external dependency** — AJV integration ships with Fastify. All route request/response shapes are validated and typed from the same schema definition.

3. **Lifecycle hooks map exactly to the API key middleware requirement** — `onRequest` runs before route handlers and supports early rejection with typed error responses.

4. **The ecosystem matches the feature set** — `@fastify/multipart` for file uploads, `@fastify/jwt` for auth tokens, and `reply.raw` for SSE are all production-ready and maintained by the Fastify organization.

5. **Node.js runtime continuity** — No toolchain split, no CI changes, no lockfile divergence.

6. **Performance at the right level** — Fastify delivers ~2x the throughput of Express on the same hardware. For a platform running on commodity hardware serving small organizations, this headroom matters without requiring Bun-level runtime changes.

---

## Consequences

**Positive:**
- Auth, Storage, DB, and Admin plugins can be developed and tested in isolation with shared context via Fastify decorators
- Schema definitions serve as both validation and auto-documentation surface (compatible with `@fastify/swagger`)
- TypeScript route generics propagate types from schema to handler without manual casting
- The SSE subscription endpoint can be implemented against the raw Node.js response object without framework interference

**Negative:**
- Schema verbosity: route definitions are more lines than Express equivalents. Mitigated by consistent structure that doubles as documentation.
- Developers unfamiliar with Fastify's plugin scoping model will need onboarding. Mitigated by documenting the plugin structure in `CONTRIBUTING.md`.

**Neutral:**
- `@fastify/multipart` requires explicit stream handling for file uploads — consistent with how the storage service will manage file I/O regardless of framework.

---

## References

- [Fastify Documentation](https://fastify.dev/docs/latest/)
- [Fastify Plugin System](https://fastify.dev/docs/latest/Reference/Plugins/)
- [AppBase README — Tech Stack](../../README.md#tech-stack)
- [AppBase README — MVP API Surface](../../README.md#mvp-api-surface)
- ADR-002 — ORM and migration strategy
- ADR-004 — Auth implementation approach
