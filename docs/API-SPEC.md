# AppBase — Public API Specification

> This document defines the **public AppBase contract**: the request formats, response schemas, headers, and error model that SDKs, demo applications, and third-party clients rely on. Internal implementation details such as `better-auth` route wiring or dashboard-only auth are intentionally out of scope.

---

## 1. Scope

This specification covers the public BaaS API exposed by `apps/api/`:

- Authentication endpoints under `/auth/*`
- Storage endpoints under `/storage/*`
- Database endpoints under `/db/*`
- Standard success and error response envelopes
- Public authentication header rules

This specification does **not** cover dashboard-internal authentication. The app-specific dashboard is an internal browser UI and may use a separate, simpler authentication mechanism such as secure cookie-based sessions.

---

## 2. Base URL

### M1

- API base URL: `http://localhost:3000`

### M2+

- API base URL: `https://api.<app>.appbase.local`

The public contract is stable across both phases; only the base URL changes.

---

## 3. Authentication and Headers

### 3.1 Header Types

| Header | Format | Used For |
|---|---|---|
| `x-api-key` | `hs_live_<token>` | Identifies the app/BaaS instance |
| `Authorization` | `Bearer <session-token>` | Session-oriented auth endpoints such as token refresh and logout |
| `Authorization` | `Bearer <access-token>` | Protected storage and database operations |

### 3.2 Rules by Endpoint Group

| Endpoint Group | Required Headers |
|---|---|
| `POST /auth/register` | none |
| `POST /auth/login` | none |
| `POST /auth/refresh` | `Authorization: Bearer <session-token>` |
| `POST /auth/logout` | `Authorization: Bearer <session-token>` |
| `/storage/*` | `x-api-key` + `Authorization: Bearer <access-token>` |
| `/db/*` | `x-api-key` + `Authorization: Bearer <access-token>` |

### 3.3 Token Semantics

- **Session token**: long-lived token used only for session lifecycle operations such as refresh and logout
- **Access token**: short-lived bearer token used for protected BaaS operations
- **API key**: app-scoped key required on all storage and database requests

The SDK is responsible for storing tokens and attaching the correct one to each request.

---

## 4. Standard Response Format

All JSON endpoints return one of the following envelopes.

### Success

```json
{
  "success": true,
  "data": {}
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "The provided access token is invalid or expired."
  }
}
```

### Error Code Set

| Code | Meaning |
|---|---|
| `VALIDATION_ERROR` | Request body, params, or query is invalid |
| `INVALID_CREDENTIALS` | Email/password pair is invalid |
| `INVALID_API_KEY` | `x-api-key` is missing or invalid |
| `INVALID_TOKEN` | Bearer token is missing, invalid, or expired |
| `FORBIDDEN` | Authenticated but not allowed to perform operation |
| `NOT_FOUND` | Requested resource does not exist |
| `CONFLICT` | Resource already exists or unique constraint violation |
| `PAYLOAD_TOO_LARGE` | Uploaded file exceeds limits |
| `INTERNAL_ERROR` | Unexpected server failure |

---

## 5. Auth Endpoints

> Auth is implemented internally with `better-auth`, but the routes below are the stable public AppBase contract.

### 5.1 POST `/auth/register`

Creates a new user account for the current app.

**Request body**

```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

**Schema**

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | yes | Must be a valid email address |
| `password` | string | yes | Plaintext password, hashed server-side |

**Success response**

```json
{
  "success": true,
  "data": {
    "accessToken": "atk_...",
    "refreshToken": "stk_...",
    "expiresIn": 900,
    "user": {
      "id": "usr_123",
      "email": "user@example.com",
      "createdAt": "2026-03-17T10:00:00.000Z",
      "updatedAt": "2026-03-17T10:00:00.000Z"
    }
  }
}
```

### 5.2 POST `/auth/login`

Authenticates a user and issues a new session.

**Request body**

```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

**Schema**

| Field | Type | Required |
|---|---|---|
| `email` | string | yes |
| `password` | string | yes |

**Success response**

Same schema as `POST /auth/register`.

### 5.3 POST `/auth/refresh`

Refreshes the access token using a valid session token.

**Headers**

```http
Authorization: Bearer <session-token>
```

**Request body**

No body.

**Success response**

```json
{
  "success": true,
  "data": {
    "accessToken": "atk_...",
    "expiresIn": 900
  }
}
```

### 5.4 POST `/auth/logout`

Revokes the active session token.

**Headers**

```http
Authorization: Bearer <session-token>
```

**Request body**

No body.

**Success response**

```json
{
  "success": true,
  "data": {
    "loggedOut": true
  }
}
```

### 5.5 Password Reset in M1

Password reset is **not part of the public MVP API contract**. In M1 it is handled through the app-specific dashboard as an admin-mediated operation.

If a self-service reset flow is introduced later, it will be added as a new public auth endpoint without changing the rest of the contract.

---

## 6. Storage Endpoints

### Shared Storage Object

```json
{
  "id": "file_123",
  "bucket": "avatars",
  "filename": "profile.png",
  "mimeType": "image/png",
  "size": 24512,
  "ownerId": "usr_123",
  "createdAt": "2026-03-17T10:00:00.000Z"
}
```

### 6.1 POST `/storage/buckets/:bucket/upload`

Uploads a file to a bucket scoped to the authenticated user.

**Headers**

```http
x-api-key: hs_live_xxxx
Authorization: Bearer <access-token>
Content-Type: multipart/form-data
```

**Path parameters**

| Param | Type | Notes |
|---|---|---|
| `bucket` | string | Bucket name chosen by the app developer |

**Form fields**

| Field | Type | Required |
|---|---|---|
| `file` | binary | yes |

**Success response**

```json
{
  "success": true,
  "data": {
    "file": {
      "id": "file_123",
      "bucket": "avatars",
      "filename": "profile.png",
      "mimeType": "image/png",
      "size": 24512,
      "ownerId": "usr_123",
      "createdAt": "2026-03-17T10:00:00.000Z"
    },
    "url": "/storage/buckets/avatars/file_123"
  }
}
```

### 6.2 GET `/storage/buckets/:bucket`

Lists files in a bucket belonging to the authenticated user.

**Headers**

```http
x-api-key: hs_live_xxxx
Authorization: Bearer <access-token>
```

**Success response**

```json
{
  "success": true,
  "data": {
    "files": [],
    "total": 0
  }
}
```

### 6.3 GET `/storage/buckets/:bucket/:fileId`

Downloads a file owned by the authenticated user.

**Headers**

```http
x-api-key: hs_live_xxxx
Authorization: Bearer <access-token>
```

**Success response**

Binary file stream. `Content-Type` matches the stored `mimeType`.

### 6.4 DELETE `/storage/buckets/:bucket/:fileId`

Deletes a file owned by the authenticated user.

**Headers**

```http
x-api-key: hs_live_xxxx
Authorization: Bearer <access-token>
```

**Success response**

```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

---

## 7. Database Endpoints

### Shared Record Object

```json
{
  "id": "rec_123",
  "collection": "passwords",
  "ownerId": "usr_123",
  "data": {
    "site": "github.com",
    "username": "amina",
    "encrypted": "..."
  },
  "createdAt": "2026-03-17T10:00:00.000Z",
  "updatedAt": "2026-03-17T10:00:00.000Z"
}
```

### 7.1 POST `/db/collections/:collection`

Creates a record in the specified collection.

**Headers**

```http
x-api-key: hs_live_xxxx
Authorization: Bearer <access-token>
Content-Type: application/json
```

**Request body**

```json
{
  "data": {
    "site": "github.com",
    "username": "amina",
    "encrypted": "..."
  }
}
```

**Success response**

```json
{
  "success": true,
  "data": {
    "id": "rec_123",
    "collection": "passwords",
    "ownerId": "usr_123",
    "data": {
      "site": "github.com",
      "username": "amina",
      "encrypted": "..."
    },
    "createdAt": "2026-03-17T10:00:00.000Z",
    "updatedAt": "2026-03-17T10:00:00.000Z"
  }
}
```

### 7.2 GET `/db/collections/:collection`

Lists records in a collection for the authenticated user.

**Headers**

```http
x-api-key: hs_live_xxxx
Authorization: Bearer <access-token>
```

**Query parameters**

| Param | Type | Required | Notes |
|---|---|---|---|
| `limit` | number | no | Maximum number of records |
| `offset` | number | no | Pagination offset |
| `filter` | string | no | Filter expression or JSON-encoded filter object |

**Success response**

```json
{
  "success": true,
  "data": {
    "items": [],
    "total": 0
  }
}
```

### 7.3 GET `/db/collections/:collection/:id`

Gets one record by ID.

### 7.4 PUT `/db/collections/:collection/:id`

Updates one record by ID.

**Request body**

```json
{
  "data": {
    "site": "gitlab.com",
    "username": "amina",
    "encrypted": "..."
  }
}
```

### 7.5 DELETE `/db/collections/:collection/:id`

Deletes one record by ID.

### 7.6 Common Response Schema for 7.3 / 7.4

```json
{
  "success": true,
  "data": {
    "id": "rec_123",
    "collection": "passwords",
    "ownerId": "usr_123",
    "data": {
      "site": "gitlab.com",
      "username": "amina",
      "encrypted": "..."
    },
    "createdAt": "2026-03-17T10:00:00.000Z",
    "updatedAt": "2026-03-17T10:05:00.000Z"
  }
}
```

### 7.7 Common Success Schema for 7.5

```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

### 7.8 GET `/db/collections/:collection/subscribe`

Opens an SSE stream for real-time changes in a collection.

**Headers**

```http
x-api-key: hs_live_xxxx
Authorization: Bearer <access-token>
Accept: text/event-stream
```

**SSE event format**

```text
event: created
data: {"type":"created","collection":"passwords","record":{"id":"rec_123","site":"github.com","username":"amina","encrypted":"..."}}
```

**Allowed event types**

- `created`
- `updated`
- `deleted`

---

## 8. Notes for Alignment

- This file defines the public AppBase contract.
- `docs/ARCHITECTURE.md` explains how that contract is hosted and routed.
- `better-auth` is an internal implementation choice, not the public route namespace.
- Dashboard authentication is intentionally separate from the public API contract.
