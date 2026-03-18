# AppBase

> A self-hosted Backend-as-a-Service platform for LAN environments and private VPCs — where data sovereignty, offline operation, and network-level control matter more than cloud scalability.

-----

## What is AppBase?

AppBase gives small organizations (clinics, schools, small businesses) the same developer experience as Firebase or Supabase — auth, file storage, and a database API — without sending a single byte outside their network.

You deploy one instance on any machine. Developers register apps against it, receive scoped API keys, and build on top of the platform. Everything runs on your hardware, on your network, with no external dependencies.

-----

## Why AppBase exists

Existing BaaS solutions fall into one of two failure modes for this use case:

|Solution                 |Problem                                                                                   |
|-------------------------|------------------------------------------------------------------------------------------|
|Firebase / Supabase Cloud|Cloud-dependent, data leaves the network, not viable for compliance-sensitive environments|
|Supabase self-hosted     |Complex infrastructure, requires DevOps expertise, not designed for LAN-first operation   |
|Appwrite                 |Monolithic, no LAN-native networking, no built-in service discovery                       |
|PocketBase               |Single binary with no multi-app isolation, no network-layer features                      |
|Dokku / Coolify          |Solves deployment, not BaaS — no auth/storage/database API surface                        |

**The gap:** No existing solution combines BaaS services with LAN-native networking in a single platform deployable on commodity hardware in under 10 minutes.

**Target users:** Healthcare clinics, schools, local government offices, and small engineering teams that cannot use cloud BaaS for compliance or cost reasons, and cannot operate Kubernetes-level infrastructure.

-----

## Feature Set

### Software Engineering Layer

- **Authentication** — User registration, login, session management, API key issuance and revocation
- **File Storage** — Bucket-based storage, upload/download, file versioning, scoped per app
- **Database API** — Collection management, full CRUD, records scoped to API key
- **Admin Dashboard** — App registration, user management, storage usage, audit log viewer
- **REST API** — Documented API surface designed for third-party app consumption
- **Multi-app isolation** — Each registered app gets isolated auth, storage, and database namespaces

### Network Engineering Layer

- **Container orchestration** — Docker SDK integration, isolated container per app instance
- **Port management** — Dynamic port assignment, tracking, and reclamation
- **Reverse proxy routing** — `app-name.AppBase.local` routes to the correct container automatically
- **mDNS service discovery** — Apps announce themselves on LAN; clients discover without manual configuration
- **Health checks** — Periodic liveness checks against each container
- **Auto-restart** — Failed containers are detected and restarted automatically
- **Network isolation** — Each app container on its own Docker network, no cross-app traffic by design
- **Observability dashboard** — Live network topology, node health, port map, traffic visibility

-----

## Architecture

### Deployment Model

AppBase follows a **single-tenant deployment model**. Each organization runs its own isolated instance. This is a deliberate decision — not a limitation — consistent with the data sovereignty requirement of the target use case. This is the same model used by GitLab, Gitea, and Outline.

### Current Architecture — M1

M1 is a **single app-scoped BaaS instance**. It contains:

- `apps/api/` — the Fastify BaaS API
- `apps/dashboard/` — the app-specific dashboard UI
- `data/appbase.sqlite` — the single SQLite database for that one app instance
- `data/storage/` — the single storage namespace for that one app instance

This is not a throwaway prototype. It is the first real product slice: one app, one API, one dashboard, one SDK, one database, one storage layer.

### Target Platform Architecture — M2+

When multi-app provisioning is introduced, AppBase adds a master control plane at `appbase.local`:

1. The master provisions app-specific BaaS instances from the base AppBase image
1. Each app instance gets an isolated port, database, and storage namespace
1. The master monitors health, tracks infra state, and manages routing metadata
1. App-specific dashboards and APIs are exposed under dedicated subdomains

The routing model is:

- `appbase.local` — master control plane
- `dashboard.<app>.appbase.local` — app-specific BaaS dashboard
- `api.<app>.appbase.local` — app-specific BaaS API
- `<app>.appbase.local` — reserved for hosted user applications later

### System Topology (Target Platform)

```
LAN / Private VPC
│
└── AppBase Host
      │
      ├── Master Process (port 80)
      │     ├── Control Plane API
      │     ├── Infra / Health Monitor
      │     ├── App Router (reverse proxy)
      │     ├── Docker SDK (container lifecycle)
      │     ├── mDNS Announcer
      │     └── Routing Metadata
      │
      ├── App BaaS Instance: inventory-system (port 3101)
      │     ├── Dashboard UI
      │     ├── Auth API
      │     ├── Storage API
      │     └── Database API
      │
      └── App BaaS Instance: password-manager (port 3102)
            ├── Dashboard UI
            ├── Auth API
            ├── Storage API
            └── Database API
```

For a deeper, implementation-level view of both the current M1 architecture and the target platform architecture, see [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md). For the public request/response contract consumed by SDKs and client apps, see [`docs/API-SPEC.md`](./docs/API-SPEC.md).

### Tech Stack

|Layer               |Technology                                           |
|--------------------|-----------------------------------------------------|
|Language            |TypeScript                                           |
|API Framework       |Fastify                                              |
|Auth Library        |better-auth (with API key plugin)                    |
|ORM                 |Drizzle ORM                                          |
|DB Driver           |better-sqlite3                                       |
|API Documentation   |OpenAPI via `@fastify/swagger` + Swagger UI          |
|Logging             |Pino (via Fastify logger)                            |
|Frontend            |Next.js 16                                           |
|Database            |SQLite (`data/appbase.sqlite` in M1, per-app DB in M2+) |
|Caching             |Deferred to M2 (SQLite is fast enough for M1)        |
|Real-time           |Server-Sent Events (SSE)                             |
|Job Queue           |BullMQ (in-process)                                  |
|Container Management|Docker SDK (`dockerode`)                             |
|Service Discovery   |mDNS                                                 |
|Reverse Proxy       |Caddy (programmatic config)                          |
|Monorepo            |Turborepo                                            |
|Testing             |Vitest (unit), Vitest (integration), Playwright (e2e)|
|CI                  |GitHub Actions                                       |
-----

## Monorepo Structure

```
AppBase/
├── apps/
│   ├── api/              # Core BaaS API
│   └── dashboard/        # Admin UI (Next.js)
├── packages/
│   ├── sdk/              # JS/TS client SDK (@appbase/sdk)
│   ├── db/               # Schema + migrations
│   ├── types/            # Shared TypeScript interfaces
│   └── config/           # Shared tsconfig, eslint, prettier
├── .github/
│   └── workflows/
│       ├── ci.yml        # lint, typecheck, unit tests (every push)
│       ├── integration.yml  # integration tests (PR to main)
│       └── e2e.yml       # Playwright (PR to main)
├── docs/
│   └── adr/              # Architecture Decision Records
├── turbo.json
├── package.json
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

-----

## MVP

> Ship something real first. The full architecture above is the locked vision — the MVP is the shortest path to a demoable, end-to-end developer experience that proves the concept.

**One app-specific BaaS instance. One dashboard. One API. One SQLite database. One storage namespace. Consumed by a real demo app through an SDK.**

### What's In, What's Deferred

| Feature | MVP | Deferred |
|---|---|---|
| Auth (register, login, refresh) | ✅ | — |
| Storage (upload, download, scoped to user) | ✅ | — |
| Database API (collections, CRUD, real-time SSE) | ✅ | — |
| API key issuance + validation | ✅ | — |
| SDK (JS/TS, wraps all 3 services) | ✅ | — |
| App-specific dashboard (basic — API keys, users, usage) | ✅ | — |
| Deployment service / app provisioning | ❌ | M2 |
| Multi-app isolation | ❌ | M2 |
| Container orchestration (dockerode) | ❌ | M2 |
| Caddy + subdomain routing | ❌ | M3 |
| mDNS service discovery | ❌ | M3 |
| Health monitor + auto-restart | ❌ | M3 |
| Frontend hosting | ❌ | M3/M4 |
| `appbase.local` master control plane | ❌ | M2 |

### MVP Runtime Shape

In M1, the BaaS unit is one API plus one app-specific dashboard. The demo application is external and consumes the API through the SDK. There is **no** deployment service, **no** master control plane, and **no** multi-app routing yet.

The public AppBase contract is the BaaS API consumed by SDKs and external clients. Dashboard authentication is separate from that public contract and may use a simpler browser-oriented auth flow.

```
Single host
│
├── Dashboard UI        → localhost:3001
├── BaaS API            → localhost:3000
├── SQLite              → data/appbase.sqlite
└── File storage        → data/storage/
```

### MVP API Surface

The API side of that BaaS unit is a single Fastify process with three service plugins behind API key validation middleware (`/auth/register` and `/auth/login` are public):

```
localhost:3000
│
├── /auth
│   ├── POST /register
│   ├── POST /login
│   ├── POST /refresh
│   ├── POST /logout
│   └── reset handled in dashboard (M1)
│
├── /storage
│   ├── POST   /buckets/:bucket/upload
│   ├── GET    /buckets/:bucket/:fileId
│   ├── DELETE /buckets/:bucket/:fileId
│   └── GET    /buckets/:bucket
│
├── /db
│   ├── POST   /collections/:collection
│   ├── GET    /collections/:collection
│   ├── GET    /collections/:collection/:id
│   ├── PUT    /collections/:collection/:id
│   ├── DELETE /collections/:collection/:id
│   └── GET    /collections/:collection/subscribe  (SSE)
│
└── /admin
    ├── GET  /users
    ├── GET  /storage/usage
    └── GET  /audit-log
```

The full public request/response contract, headers, and error format are defined in [`docs/API-SPEC.md`](./docs/API-SPEC.md).

In M1, password reset is handled through the app-specific dashboard rather than a public API endpoint.

### The SDK is Not Optional

The SDK is what makes this feel like Amplify and not just a REST API. It needs to do three things internally: store and refresh tokens automatically, inject the ID token into every storage/db request header, and manage the SSE subscription lifecycle.

```typescript
import { AppBase } from '@appbase/sdk'

const client = AppBase.init({
  endpoint: 'http://localhost:3000',
  apiKey: 'hs_live_xxxx'
})

// Auth
await client.auth.signUp({ email, password })
const session = await client.auth.signIn({ email, password })

// Storage — ID token injected automatically
await client.storage.upload('avatars', file)
const url = await client.storage.getUrl('avatars', fileId)

// DB — scoped to user automatically
await client.db.collection('passwords').create({ site, username, encrypted })
const items = await client.db.collection('passwords').list()

// Real-time
client.db.collection('passwords').subscribe((change) => {
  console.log('record changed', change)
})
```

### SQLite Strategy

M1 uses a single SQLite file: `data/appbase.sqlite`. This is correct for the MVP because there is only one app-specific BaaS instance and no deployment service yet.

In M2, the storage model splits cleanly:

- `data/master.sqlite` for the control plane
- `data/{appId}/app.sqlite` for each provisioned app
- `data/{appId}/storage/` for each app's files

That keeps M1 simple without forcing the master/provisioning layer to exist before it is actually needed.

-----

## Development Milestones

### M1 — MVP: Working Single Instance (Weeks 1–4)

Built vertically — one thin slice end to end first, then fill out:

**Week 1** — Auth + API key middleware complete. SDK auth module working against it.

**Week 2** — DB API complete (CRUD, no SSE yet). SDK db module working. Demo app (password manager) stores and retrieves passwords. **First demoable checkpoint.**

**Week 3** — Storage complete. SDK storage module. Demo app stores file attachments.

**Week 4** — SSE real-time on DB. SDK `subscribe()`. Demo app updates live without refresh. Basic app-specific dashboard. Single `docker run` command starts the BaaS unit.

Deliverable: one app-specific BaaS unit, a working SDK, and a password manager demo that runs fully offline.

### M2 — Container Orchestration (Weeks 5–6)

- Master control plane at `appbase.local`
- App provisioning / deletion service
- Docker SDK integration (`dockerode`)
- App creation spins up an isolated BaaS instance
- Per-app SQLite and storage namespaces
- Port assignment and management
- Master tracks app state and lifecycle

### M3 — Network Layer (Weeks 7–8)

- Reverse proxy routing (`dashboard.<app>.appbase.local`, `api.<app>.appbase.local`)
- mDNS service announcement and discovery
- Health checks with auto-restart
- Network isolation between app containers
- Reserve `<app>.appbase.local` for hosted user applications

### M4 — Observability and Polish (Weeks 9–10)

- Network topology dashboard
- Live health status and port map
- API documentation
- Full end-to-end demo scenario (offline, multi-app, auto-restart)

-----

## Demo Scenario

### M1 Demo Scenario

1. Start the AppBase BaaS unit on a local machine
1. Open the app-specific dashboard on `localhost:3001`
1. Generate an API key and inspect app users, storage usage, and records
1. Point the password manager demo app at `http://localhost:3000`
1. The password manager authenticates users, stores credentials, uploads files, and receives live updates — all via the SDK
1. **Pull the network cable to the internet.** Everything still works.

### Full Platform Demo Scenario (M2+)

1. Open `appbase.local`
1. Create a new app (`password-manager`) from the master control plane
1. AppBase provisions a BaaS instance, assigns a port, and registers routing metadata
1. Open `dashboard.password-manager.appbase.local` to manage that app's BaaS
1. Point the demo app at `api.password-manager.appbase.local`
1. Later, host the actual user-facing application at `password-manager.appbase.local`

-----

## What This Project Demonstrates

### For a Network Engineering audience

- LAN-native service discovery (mDNS)
- Container network isolation and management
- Reverse proxy configuration and dynamic routing
- Failure detection and automatic recovery
- Network observability and topology visualization

### For a Software Engineering audience

- REST API design for third-party consumption
- Multi-app isolation patterns
- Background job processing architecture
- Session-based auth with API key management
- File versioning and bucket-based storage

-----

## ADR Index

Architecture Decision Records are maintained in `/docs/adr/`. Current decisions documented:

- `ADR-001` — API framework selection
- `ADR-002` — ORM and migration strategy
- `ADR-003` — Auth implementation strategy

-----

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

-----

## License

See [LICENSE](./LICENSE).

-----

*AppBase is a Final Year Project (PFE) for a Network and Telecommunications Engineering degree. It sits at the intersection of software engineering and network engineering, designed to be both academically rigorous and practically useful.*