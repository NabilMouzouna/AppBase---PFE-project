# Manual API Testing

## Prerequisites

1. **Start the API** (at least once so the DB exists):
   ```bash
   pnpm --filter api dev
   ```

2. **Create an API key** (BaaS: apps must be registered first):
   ```bash
   pnpm --filter api create-api-key
   ```
   Copy the key and set `@apiKey = <your-key>` at the top of `api.http`.

3. **Optional**: Create `apps/api/.env` with:
   ```
   AUTH_SECRET=your-secret-at-least-32-characters-long
   BASE_URL=http://localhost:3000
   ```

## Option 1: VS Code REST Client

1. Install the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension.
2. Open `apps/api/api.http`.
3. Click **Send Request** above any `###` block to run that request.

### Using tokens

After **Login**, copy the `refreshToken` from the response. For **Refresh** and **Logout**, replace `YOUR_REFRESH_TOKEN_HERE` in the `Authorization` header with that token.

## Option 2: JetBrains HTTP Client

1. Open `apps/api/api.http` in IntelliJ IDEA, WebStorm, or another JetBrains IDE.
2. Click the run icon next to a request to execute it.

## Option 3: cURL

Replace `YOUR_API_KEY` with the key from `create-dev-api-key.ts`:

```bash
# Health (no API key)
curl http://localhost:3000/health

# Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"email":"test@example.com","password":"SecurePassword123!"}'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"email":"test@example.com","password":"SecurePassword123!"}'

# Refresh (replace TOKEN with refreshToken from login)
curl -X POST http://localhost:3000/auth/refresh \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Authorization: Bearer TOKEN"

# Logout
curl -X POST http://localhost:3000/auth/logout \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Authorization: Bearer TOKEN"
```

## Option 4: Swagger UI

1. Start the API: `pnpm --filter api dev`
2. Open http://localhost:3000/docs in a browser
3. Use the interactive docs to try endpoints

## Test flow

1. **Health** – Check the API is running.
2. **Register** – Create a user; you get `accessToken`, `refreshToken`, and `user`.
3. **Login** – Sign in with the same credentials.
4. **Refresh** – Send `refreshToken` in `Authorization: Bearer <token>` to get a new `accessToken`.
5. **Logout** – Send `refreshToken` to invalidate the session (optional; 200 even without a token).

## Automated tests

```bash
pnpm --filter api test
```
