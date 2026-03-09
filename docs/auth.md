# Authentication & Users

## Overview

Editions uses a local user database with username/password authentication and JWT tokens. The system is designed for small self-hosted deployments with one or a few users per server.

## Roles

Two roles exist:

- **`admin`** — full access. The first user registered on a fresh server is automatically promoted to admin.
- **`user`** — standard access.

Roles are stored in the `users.role` column and embedded in the JWT payload.

## Registration

`POST /api/auth/register`

```json
{ "username": "alice", "password": "secret1234" }
```

**Constraints:** username 1–64 chars (unique), password 8–256 chars.

**Response (201):**

```json
{ "id": "uuid", "role": "admin", "token": "eyJ..." }
```

The first user ever registered gets `role: "admin"`. All subsequent users get `role: "user"`.

**Errors:** 403 if signups are disabled, 409 if username is taken, 400 if validation fails.

## Login

`POST /api/auth/login`

```json
{ "username": "alice", "password": "secret1234" }
```

**Response (200):**

```json
{ "id": "uuid", "role": "admin", "token": "eyJ..." }
```

**Errors:** 401 for wrong username or password.

## Current user

`GET /api/auth/me` (authenticated)

**Response (200):**

```json
{ "id": "uuid", "username": "alice", "role": "admin" }
```

## JWT tokens

- **Algorithm:** HS256 (symmetric, via `jose` library)
- **Issuer:** `"editions"`
- **Payload:** `{ sub: userId, username, role, iat, iss }`
- **Expiration:** None currently. Refresh tokens are planned.
- **Secret:** Read from `EDITIONS_JWT_SECRET` env var or config file. If not set, a random secret is generated at startup (tokens won't survive restarts).

## Password hashing

Passwords are hashed using Node.js `crypto.scrypt` with:

- Key length: 64 bytes
- Cost (N): 16384
- Block size (r): 8
- Parallelization (p): 1

Stored as `salt:hash` in the `users.password_hash` column. The salt is 16 random bytes (hex-encoded).

## Auth middleware

Protected routes use the `createAuthHook(services)` function as a Fastify `onRequest` hook. It:

1. Extracts the token from the `Authorization: Bearer <token>` header
2. Verifies the JWT signature and issuer
3. Populates `req.user` with the decoded `TokenPayload`
4. Returns 401 if the header is missing or the token is invalid

**Usage in route definitions:**

```typescript
const authenticate = createAuthHook(services);

fastify.route({
  method: "GET",
  url: "/some/protected/route",
  onRequest: authenticate,
  schema: {
    security: [{ bearerAuth: [] }],  // OpenAPI annotation
    // ...
  },
  handler: async (req, reply) => {
    const userId = req.user.sub;
    const role = req.user.role;
    // ...
  },
});
```

The `security` property in the schema is required for the OpenAPI spec to show the lock icon in Scalar docs. It does not enforce authentication — the `onRequest` hook does.

## Public config endpoint

`GET /api/config` (unauthenticated)

Returns server configuration relevant to the frontend (e.g., whether signups are enabled). The login page uses this to show or hide the registration option.

**Response (200):**

```json
{ "allowSignups": true }
```

## Configuration

Auth settings can be set via config file or environment variables:

1. Config file (`editions.json`): `{ "auth": { "jwtSecret": "your-secret-here", "allowSignups": false } }`
2. Environment variables: `EDITIONS_JWT_SECRET=your-secret-here`, `EDITIONS_ALLOW_SIGNUPS=false`

If no JWT secret is set, an ephemeral random secret is generated at startup with a console warning.

Setting `allowSignups` to `false` disables the `POST /api/auth/register` endpoint (returns 403) and hides the signup button on the login page.

## Future plans

- **OAuth / external identity providers** — a separate `identities` table will link external logins (e.g. GitHub, Google) to user accounts. `users.password_hash` is nullable to support OAuth-only users.
- **Refresh tokens** — short-lived access tokens + long-lived refresh tokens with rotation.
- **Token expiration** — access tokens will get an expiration time once refresh tokens are implemented.

## Code layout

**Server:**

```
apps/server/src/auth/
├── auth.ts              # AuthService, password hashing, JWT, error classes
└── auth.middleware.ts   # createAuthHook, FastifyRequest augmentation

apps/server/src/api/
└── auth.routes.ts       # POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
```

**Frontend:**

```
apps/web/src/auth/
└── auth.tsx             # AuthProvider context, useAuth hook, login/register/logout
```

The frontend `AuthProvider` persists the JWT token in `localStorage`, validates it on mount via `/api/auth/me`, and exposes `login`, `register`, and `logout` functions through React context.
