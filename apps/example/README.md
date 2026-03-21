# Example app (`apps/example`)

Modern Next.js todo application using `@appbase/sdk` for auth and database access.

## Purpose

- Validate end-to-end auth + protected dashboard flow
- Demonstrate real todo CRUD via SDK database client
- Provide a clean reference structure for future frontend apps

## Setup

1. Make sure API is running at `http://localhost:3000` (or your custom endpoint).
2. Create `apps/example/.env.local` from `.env.example`.
3. Put a valid instance API key in `NEXT_PUBLIC_APPBASE_API_KEY`.
4. Start this app.

```bash
pnpm --filter example dev
```

## Environment variables

- `NEXT_PUBLIC_APPBASE_ENDPOINT`
- `NEXT_PUBLIC_APPBASE_API_KEY`

Both are validated in `lib/env.ts`.

## Routes

- `/` Home (entry and navigation)
- `/sign-up` Account creation
- `/sign-in` Account login
- `/dashboard` Protected todo dashboard

## Features

- Sign up and sign in using `appBase.auth.*`
- Protected dashboard redirecting unauthenticated users to `/sign-in`
- Todo create/list/toggle/delete using `appBase.db.collection("todos")`
- Sign out from dashboard

## SDK integration points

- App provider + hook: `lib/appbase.tsx`
- Auth guard helpers: `lib/auth.ts`
- Public env parsing: `lib/env.ts`
- Dashboard DB usage: `app/dashboard/page.tsx`

## Notes

- Session is currently client-memory based (SDK default).
- Make sure your API key can access auth and db endpoints.
