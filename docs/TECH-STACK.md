# AppBase — Software Stack Overview

This document summarizes the core technology choices for the AppBase platform and how they fit together. For a full architecture view (components, data flows, schemas, and ports), see [`ARCHITECTURE.md`](./ARCHITECTURE.md) and the ADRs referenced below.

---

## Backend API

- **Framework**: Fastify  
  - Plugin-per-service architecture: Auth, Storage, Database, and Admin are registered as isolated Fastify plugins.
  - `onRequest` / `preHandler` hooks provide central API key and JWT validation.
  - Native integration with OpenAPI/Swagger via `@fastify/swagger` and `@fastify/swagger-ui`.

- **API Documentation**: OpenAPI + Swagger  
  - Route schemas are defined once and used both for validation and documentation.
  - `@fastify/swagger` generates the OpenAPI spec; `@fastify/swagger-ui` serves `/docs`.

- **Logging**: Pino  
  - Structured JSON logs are emitted for startup, requests, and operational failures.
  - Fastify uses Pino directly, so framework logs and application logs share one format.
  - Sensitive headers such as `Authorization` and `x-api-key` are redacted centrally.

---

## Authentication

- **Library**: better-auth  
  - Handles email/password auth, session tokens, and integration with the database layer.
  - Simplifies auth flows while keeping the implementation within the Node.js/TypeScript stack.

- **Token Model**:  
  - Short-lived JWT access tokens (EdDSA) for hot-path requests.
  - Refresh tokens stored in SQLite for rotation and logout.
  - API keys bound to apps for server-to-server access and SDK initialization.

- **Contract Boundary**:
  - The public AppBase contract is documented in [`API-SPEC.md`](./API-SPEC.md) and uses AppBase-owned routes and schemas.
  - `better-auth` is the internal auth implementation, not the public route namespace.
  - Dashboard authentication is separate from the public BaaS API contract and can use a browser-oriented session model if that remains the simplest option.

Implementation details and trade-offs are captured in `docs/adr/ADR-003-auth-implementation.md`.

---

## Data Layer

- **ORM**: Drizzle ORM  
  - Type-safe schema definitions for SQLite tables (`users`, `refresh_tokens`, `api_keys`, `files`, `records`, `audit_log`).
  - Migrations generated and applied via `drizzle-kit`.

- **Database Engine**: SQLite  
  - MVP: single `data/appbase.sqlite` file.
  - M2+: one `app.sqlite` per app under `data/{appId}/`, plus a `master.sqlite` for orchestration metadata.

- **Driver**: better-sqlite3  
  - Embedded, synchronous driver optimized for low-latency local access.
  - Well-suited for LAN-first deployments on a single host.

The ORM and database strategy are detailed in `docs/adr/ADR-002-orm-and-migration-strategy.md`.

---

## Client SDK

- **Package**: `@appbase/sdk` (TypeScript)  
  - Wraps all three BaaS services (Auth, Storage, Database) behind a single client interface.
  - Handles token storage and refresh, header injection, and SSE subscription lifecycle for real-time updates.

The SDK is a first-class part of the MVP; without it the platform would be a raw REST API.

---

## Cross-References

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system components, flows, schemas, and ports.
- [`API-SPEC.md`](./API-SPEC.md) — public request/response contract for Auth, Storage, and Database APIs.
- [`adr/ADR-001-api-framework-selection.md`](./adr/ADR-001-api-framework-selection.md) — Fastify selection and alternatives.
- [`adr/ADR-002-orm-and-migration-strategy.md`](./adr/ADR-002-orm-and-migration-strategy.md) — Drizzle ORM + SQLite + better-sqlite3.
- [`adr/ADR-003-auth-implementation.md`](./adr/ADR-003-auth-implementation.md) — better-auth and the token/API key strategy.

