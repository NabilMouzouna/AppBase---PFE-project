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

### App Isolation

When a developer creates an app through the dashboard:

1. AppBase spins up a container from the base AppBase image
1. Assigns an isolated port from the managed port range
1. Creates a dedicated storage namespace
1. Provisions an isolated SQLite database
1. Issues a scoped API key bound to that app’s resources
1. Registers the service via mDNS on the LAN

The app is then accessible at `http://{app-name}.AppBase.local` from any device on the network.

### System Topology

```
LAN / Private VPC
│
└── AppBase Host
      │
      ├── Master Process (port 80)
      │     ├── Admin Dashboard
      │     ├── App Router (reverse proxy)
      │     ├── Docker SDK (container lifecycle)
      │     ├── mDNS Announcer
      │     └── Health Monitor
      │
      ├── App Container: inventory-system (port 3101)
      │     ├── Auth API
      │     ├── Storage API
      │     └── Database API
      │
      └── App Container: password-manager (port 3102)
            ├── Auth API
            ├── Storage API
            └── Database API
```

For a deeper, implementation-level view (components, data flows, schemas, and ports), see [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

### Tech Stack

|Layer               |Technology                                           |
|--------------------|-----------------------------------------------------|
|Language            |TypeScript                                           |
|API Framework       |Fastify                                              |
|Auth Library        |better-auth (with API key plugin)                    |
|ORM                 |Drizzle ORM                                          |
|DB Driver           |better-sqlite3                                       |
|API Documentation   |OpenAPI via `@fastify/swagger` + Swagger UI          |
|Frontend            |Next.js 16                                           |
|Database            |SQLite (per app container)                           |
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
│   ├── sdk/              # JS/TS client SDK (@homestack/sdk)
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

**One container. One app. All three BaaS services working. Consumed by a real demo app through an SDK.**

### What's In, What's Deferred

| Feature | MVP | Deferred |
|---|---|---|
| Auth (register, login, refresh, reset) | ✅ | — |
| Storage (upload, download, scoped to user) | ✅ | — |
| Database API (collections, CRUD, real-time SSE) | ✅ | — |
| API key issuance + validation | ✅ | — |
| SDK (JS/TS, wraps all 3 services) | ✅ | — |
| Admin dashboard (basic — one app, users, usage) | ✅ | — |
| Multi-app isolation | ❌ | M2 |
| Container orchestration (dockerode) | ❌ | M2 |
| Caddy + subdomain routing | ❌ | M3 |
| mDNS service discovery | ❌ | M3 |
| Health monitor + auto-restart | ❌ | M3 |
| Frontend hosting | ❌ | M3/M4 |
| infra.homestack.local control plane | ❌ | M4 |

### MVP API Surface

Single container, single Fastify process, three service plugins behind API key validation middleware (`/auth/register` and `/auth/login` are public):

```
localhost:3000
│
├── /auth
│   ├── POST /register
│   ├── POST /login
│   ├── POST /refresh
│   ├── POST /logout
│   └── POST /reset-password
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

### The SDK is Not Optional

The SDK is what makes this feel like Amplify and not just a REST API. It needs to do three things internally: store and refresh tokens automatically, inject the ID token into every storage/db request header, and manage the SSE subscription lifecycle.

```typescript
import { HomeStack } from '@homestack/sdk'

const client = HomeStack.init({
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

### SQLite Strategy: One File Per App (M2-Ready)

Each registered app gets `data/{appId}.sqlite`. This costs roughly two extra hours in the MVP versus a shared schema-prefixed DB, but when M2 moves to container-per-app the file moves with no refactor — the abstraction is already correct.

-----

## Development Milestones

### M1 — MVP: Working Single Instance (Weeks 1–4)

Built vertically — one thin slice end to end first, then fill out:

**Week 1** — Auth + API key middleware complete. SDK auth module working against it.

**Week 2** — DB API complete (CRUD, no SSE yet). SDK db module working. Demo app (password manager) stores and retrieves passwords. **First demoable checkpoint.**

**Week 3** — Storage complete. SDK storage module. Demo app stores file attachments.

**Week 4** — SSE real-time on DB. SDK `subscribe()`. Demo app updates live without refresh. Basic admin dashboard. Single `docker run` command starts everything.

Deliverable: one container, three services, a working SDK, and a password manager demo that runs fully offline.

### M2 — Container Orchestration (Weeks 5–6)

- Docker SDK integration (`dockerode`)
- App creation spins up an isolated container
- Per-app SQLite file migrates cleanly (foundation already set in M1)
- Port assignment and management
- Basic routing from master to container

### M3 — Network Layer (Weeks 7–8)

- Reverse proxy routing (`app.AppBase.local`)
- mDNS service announcement and discovery
- Health checks with auto-restart
- Network isolation between app containers

### M4 — Observability and Polish (Weeks 9–10)

- Network topology dashboard
- Live health status and port map
- API documentation
- Full end-to-end demo scenario (offline, multi-app, auto-restart)

-----

## Demo Scenario

1. Spin up AppBase on a local machine
1. Open the admin dashboard — register a new app (`password-manager`)
1. AppBase provisions a container, assigns a port, announces via mDNS
1. Access `http://password-manager.AppBase.local` from another device on the LAN — it resolves
1. The password manager app authenticates users, stores credentials, and retrieves files — all via AppBase APIs
1. **Pull the network cable to the internet.** Everything still works.
1. Simulate a container crash. Watch the health monitor detect it and restart the container automatically.
1. Show the network topology dashboard — live container states, port assignments, health status.

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

Architecture Decision Records are maintained in `/docs/adr/`. Key decisions documented:

- `ADR-001` — API framework selection
- `ADR-002` — ORM and migration strategy
- `ADR-003` — SQLite vs PostgreSQL for Phase 1
- `ADR-004` — Auth implementation approach
- `ADR-005` — Reverse proxy selection
- `ADR-006` — Container isolation vs schema isolation

-----

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

-----

## License

See [LICENSE](./LICENSE).

-----

*AppBase is a Final Year Project (PFE) for a Network and Telecommunications Engineering degree. It sits at the intersection of software engineering and network engineering, designed to be both academically rigorous and practically useful.*