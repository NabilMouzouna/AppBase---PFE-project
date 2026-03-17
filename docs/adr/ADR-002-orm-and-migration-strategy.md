# ADR-002 — ORM and Migration Strategy

**Status:** Accepted  
**Date:** 2026-03-17  
**Deciders:** AppBase core team  
**Tags:** `backend`, `database`, `sqlite`, `architecture`

---

## Context

AppBase uses SQLite as its database engine (ADR-003). The platform must define how application code queries that database and how schema changes are applied over time.

Two constraints shape this decision significantly:

**1. Dual data model within a single SQLite file.**  
AppBase stores two fundamentally different kinds of data:

- **Platform-internal tables** — fixed schema, known at build time: `users`, `sessions`, `api_keys`, `files`, `audit_log`. These benefit directly from compile-time type safety.
- **User-defined collections** — dynamic schema, defined at runtime by developers consuming AppBase via the `/db` API. These are stored as a `records` table with `collection`, `id`, `data` (JSON), `created_at`, `updated_at` columns. No ORM provides type safety over these contents at compile time because the shape is unknown ahead of time.

Type-safe query tooling applies meaningfully to the platform schema. The user collection layer is a document store abstraction built on top of a fixed `records` table — it benefits from type safety only on the table structure itself, not on the JSON payload.

**2. One SQLite file per app container (M2-ready).**  
The README establishes that each registered app gets `data/{appId}.sqlite`. In M1, this is a single file. From M2 onward, each app container starts with a fresh SQLite file and must run migrations against it on startup without a CLI step. The migration system must support programmatic execution against an arbitrary file path.

Additional constraints:

- TypeScript throughout (`packages/db` is a dedicated monorepo package for schema and migrations)
- Node.js runtime (Turborepo + npm toolchain)
- Migration files must be human-readable and version-controlled
- Vitest integration testing must be able to spin up in-memory or temp-file SQLite databases with the same migration path

---

## Decision

**Drizzle ORM** (`drizzle-orm`) with the **`better-sqlite3`** driver and **`drizzle-kit`** for migration generation.

| Package | Role |
|---|---|
| `drizzle-orm` | Runtime query builder and type inference |
| `better-sqlite3` | Synchronous SQLite driver |
| `drizzle-kit` | Dev-time migration file generation (devDependency) |

---

## Options Considered

### Option 1 — Raw SQLite with migration scripts

Pure `.sql` migration files applied by a custom runner.

**Strengths:**
- Zero runtime dependencies
- SQL is fully explicit and portable
- No abstraction surprises

**Weaknesses:**
- No type safety — a column rename is a runtime error, not a compile error
- Requires building a migration tracker: a `schema_migrations` table, a file reader, an applied-version recorder. This is non-trivial infrastructure that must be maintained
- Queries are raw strings duplicated across service files with no shared type guarantees
- Two sources of truth: the SQL schema and any TypeScript types written manually for query results

**Assessment:** The migration tracker problem is non-trivial undifferentiated work. Building it from scratch replaces functionality that Drizzle ships as a single `migrate()` call. Eliminated.

---

### Option 2 — Drizzle ORM

Schema defined in TypeScript. Types and SQL migrations both derived from that single source.

**Strengths:**

| Feature | AppBase Application |
|---|---|
| TypeScript schema as single source of truth | `packages/db/src/schema.ts` is the sole definition — types and migrations both flow from it, not maintained separately |
| `drizzle-kit generate` → numbered `.sql` files | Human-readable, diff-friendly, version-controlled migration files. No magic binary blobs |
| `drizzle(new Database(path), { schema })` | Accepts any `better-sqlite3` connection — critical for per-container database bootstrapping in M2+ |
| Programmatic `migrate(db, { migrationsFolder })` | New app container calls `migrate()` at startup. No CLI, no external process, no shell step in a container entrypoint |
| Type-safe queries on platform tables | Column renames on `users`, `sessions`, `api_keys`, `files`, `audit_log` are caught at compile time |
| Not ActiveRecord | No hidden lazy loading, no N+1 traps, no `save()` / `refresh()` lifecycle. Queries execute exactly what is written |
| Vitest compatibility | Integration tests open a temp-file or `:memory:` SQLite database, call `migrate()`, and run against real migrations |

The monorepo already has `packages/db` dedicated to schema and migrations. Drizzle's schema file is that package's primary export. The package boundary is natural: `packages/db` exports the schema, the `db` instance factory, and the `migrate()` wrapper — everything the `apps/api` service needs.

**Weaknesses:**
- `drizzle-kit` is a devDependency with its own CLI — a build-time addition, not a runtime one
- Drizzle has evolved its API between major versions; pinning to a stable version matters

**Assessment:** Matches the project structure, satisfies both the type-safety and multi-database migration requirements, and keeps the `packages/db` boundary clean. Selected.

---

### Option 3 — Kysely

Type-safe SQL query builder. No schema definition, no migration generation.

**Strengths:**
- Very close to raw SQL with full TypeScript inference: `db.selectFrom('users').where('email', '=', email).selectAll()`
- Explicit — no framework behavior between the code and the database
- Mature and stable

**Weaknesses:**
- **Two sources of truth.** TypeScript table interfaces must be written manually *and* SQL migration scripts maintained separately. A column rename requires changes in two places; there is no generator to keep them aligned.
- No built-in migration system. Adding Kysely means also choosing a migration tool (`kysely-migration`, `umzug`, or custom) — three moving parts where Drizzle provides one.
- Kysely's type safety requires maintaining the TypeScript interface definitions as an ongoing task; Drizzle derives them automatically from the schema.

**Assessment:** Kysely is the right choice when you want type-safe queries but own the migration story separately. For AppBase, Drizzle provides the same type-safe query layer while also solving migration generation and programmatic execution from the same schema. Eliminated.

---

### Option 4 — better-sqlite3 + custom query helpers

`better-sqlite3` as the driver with hand-written query utility functions.

**Strengths:**
- Synchronous API — no async/await noise for SQLite operations
- Full control over every query
- No additional abstraction layer

**Weaknesses:**
- All weaknesses of raw SQL: no type safety, no migration generation, manual tracking
- "Custom query helpers" means incrementally building what Drizzle already is
- Query strings distributed across service files are harder to refactor and silently break on schema changes

**Assessment:** `better-sqlite3` is the correct **driver** — and Drizzle uses it. As the entire abstraction layer, this option is raw SQL with additional boilerplate. The synchronous API benefit is preserved by using `better-sqlite3` underneath Drizzle. Eliminated as a standalone approach.

---

## Rationale

The decision is driven by three AppBase-specific requirements:

**1. The `packages/db` package structure is already the Drizzle pattern.**  
The monorepo designates `packages/db` for schema and migrations. In the Drizzle model this package exports:
- `schema.ts` — the TypeScript schema definition (Drizzle `sqliteTable` declarations)
- `migrate.ts` — a `createDb(path: string)` factory that opens the SQLite file, runs pending migrations, and returns a typed Drizzle instance
- `migrations/` — the generated `.sql` files produced by `drizzle-kit generate`

Every other package (`apps/api`, tests) imports from `@appbase/db`. The schema is never defined twice.

**2. Programmatic migration satisfies the M2 container bootstrap requirement.**  
When an app container starts in M2+:

```typescript
// apps/api/src/bootstrap.ts
import { createDb } from '@appbase/db'

const db = createDb(process.env.DB_PATH ?? './data/app.sqlite')
// migrate() is called inside createDb — container is ready
```

No shell step, no CLI invocation, no migration sidecar container. The database is migrated and ready before the Fastify server starts accepting requests.

**3. Type safety covers exactly where it adds value.**  
Platform tables (`users`, `sessions`, `api_keys`, `files`, `audit_log`) are fixed schema — Drizzle's compile-time types catch regressions here. User-defined collections are stored as JSON in a fixed `records` table — type safety applies at the table structure level, not the JSON payload level, which is correct. No ORM would provide more safety here without knowing the user's schema in advance.

---

## Package Structure

```
packages/db/
├── src/
│   ├── schema.ts          # All table definitions (Drizzle sqliteTable)
│   ├── migrate.ts         # createDb(path) factory — opens + migrates
│   └── index.ts           # Re-exports schema, createDb, and inferred types
├── migrations/            # Generated .sql files (drizzle-kit output, committed)
├── drizzle.config.ts      # drizzle-kit configuration
└── package.json
```

---

## Schema Overview

The platform schema covers the following tables. User collection data is stored in `records` with a JSON `data` column — the Database API builds its CRUD and SSE logic on top of this table.

```
users            — id, email, password_hash, created_at
sessions         — id, user_id, token, expires_at, created_at
api_keys         — id, app_id, key_hash, created_at, revoked_at
files            — id, app_id, bucket, filename, size, created_at
audit_log        — id, app_id, action, actor_id, payload, created_at
records          — id, collection, app_id, data (JSON), created_at, updated_at
```

---

## Consequences

**Positive:**
- Schema changes start in `schema.ts` — the TypeScript compiler and `drizzle-kit` propagate the change to both types and migration files
- Integration tests use the same `createDb()` factory with a temp path, exercising real migrations on every test run
- Migration files are committed plain SQL — reviewable in PRs, reversible by inspection
- The `better-sqlite3` synchronous API eliminates async/await overhead on a single-writer database engine where it provides no benefit

**Negative:**
- `drizzle-kit` must be run locally (or in CI) after schema changes to generate migrations. This is a deliberate step, not automatic.
- Drizzle does not manage relation-level cascade deletes through its ORM — these must be declared in the schema as SQLite `REFERENCES ... ON DELETE CASCADE` constraints or handled in application code.

**Neutral:**
- The user-facing Database API (`/db/collections/:collection`) is a document store abstraction over the `records` table. Drizzle is used to query `records` — the JSON `data` payload is handled by the application layer, not by Drizzle's type system.

---

## References

- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [Drizzle Kit — Migrations](https://orm.drizzle.team/docs/kit-overview)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [AppBase README — SQLite Strategy](../../README.md#sqlite-strategy-one-file-per-app-m2-ready)
- [AppBase README — Monorepo Structure](../../README.md#monorepo-structure)
- ADR-001 — API framework selection (Fastify)
- ADR-003 — SQLite vs PostgreSQL for Phase 1
