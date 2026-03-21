# `apps/api`

The AppBase API is the Fastify-based backend for one app-scoped BaaS instance.

In M1, this service is the core runtime for:

- authentication
- storage
- database operations
- admin-facing management endpoints
- OpenAPI documentation

At the moment, this package is still in the scaffolding phase. The infrastructure is in place, but only the `/health` route is implemented.

## Current Responsibilities

- boot the Fastify server
- load and validate environment variables
- initialize the SQLite-backed database layer
- register shared infrastructure plugins
- expose Swagger UI and OpenAPI output
- provide structured logging with Pino
- provide common middleware such as not-found and error handling

## Current Structure

```text
src/
├── app.ts                 # Fastify app factory
├── index.ts               # Process entrypoint
├── config/
│   ├── env.ts             # Typed environment loading
│   └── logger.ts          # Pino/Fastify logger configuration
├── middleware/
│   ├── error-handler.ts   # Centralized error responses
│   ├── index.ts
│   └── not-found.ts       # 404 handling
├── plugins/
│   ├── database.ts        # DB decoration and initialization
│   └── infrastructure.ts  # CORS, multipart, Swagger, Swagger UI
├── routes/
│   ├── health.ts          # /health route + OpenAPI schema
│   └── index.ts
├── types/
│   └── fastify.d.ts       # Fastify instance decorations
└── utils/
    └── filesystem.ts      # Small filesystem helpers
```

## Runtime

Default runtime values:

- `HOST=0.0.0.0`
- `PORT=3000`
- `DB_PATH=data/appbase.sqlite`
- `LOG_LEVEL=info`

Optional / reserved values:

- `BASE_URL`:
  used by generated OpenAPI server metadata and future auth integration
- `AUTH_SECRET`:
  reserved for the planned `better-auth` integration

### Local Environment Files

- `.env` is used for local development convenience
- `.env.example` documents the expected variables for the API package
- runtime-provided environment variables still take precedence over `.env`

This means local `pnpm dev` can work with `apps/api/.env`, while Docker and
production deployments can inject variables normally at runtime.

## Available Endpoints

### `GET /health`

Returns a simple liveness response:

```json
{
  "status": "ok"
}
```

### API Docs

- Swagger UI: `/docs`
- OpenAPI JSON: `/docs/json`

## Manual testing

See [TESTING.md](./TESTING.md) for how to test manually with `.http` files, cURL, or Swagger UI.

## Scripts

- `pnpm --filter api dev` — run the API in watch mode with `tsx`
- `pnpm --filter api build` — type-check and emit compiled output
- `pnpm --filter api check-types` — run TypeScript only
- `pnpm --filter api lint` — lint `src/`
- `pnpm --filter api test` — run tests

## What Is Intentionally Not Implemented Yet

This package does **not** yet include:

- auth route logic
- storage route logic
- database CRUD route logic
- admin route logic
- API key / JWT middleware
- `better-auth` wiring

Those will be added in later tickets once the infrastructure foundation is stable.

## Architecture Context

This API belongs to the same app-scoped BaaS unit as `apps/dashboard/`.

For M1:

- `apps/api` serves the backend on port `3000`
- `apps/dashboard` is the UI for the same app instance
- both share the same app-scoped DB/storage concept

Later, in M2+, each provisioned app instance will still have its own API and dashboard, while `apps/master` becomes the global control plane that orchestrates those instances.
