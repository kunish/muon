# Missing Backend — Phase 0: Persistent Admin Sessions

Date: 2026-05-14

## Context

The 2026-05-02 enterprise auth design landed admin login, organization/user CRUD, audit logs, and the desktop OAuth flow. A follow-up audit found 11 gaps where the frontend implies behavior the backend never fully delivered. These gaps split into five phases. This document specifies **Phase 0**, which is a prerequisite for the other four.

The two items in Phase 0:

- **B1** — Replace the in-memory `adminTokens` Map in `apps/api/src/routes.ts` with a DB-backed admin session, validated through `adminSessionService`.
- **D1** — Have the admin web app validate its stored token on bootstrap by calling `GET /api/admin/me`.

## Goal

After Phase 0:

- Admin sessions survive an API process restart.
- A stolen DB dump does not directly grant admin access (tokens are hashed at rest).
- The admin web app does not silently sit on a dead token until the first list call fails — it learns within one round-trip on load.
- The codebase is positioned to add `logout`, `refresh`, and force-change-password without further session-layer refactors.

## Non-Goals

- Token rotation, JWT, or refresh token rotation. Refresh is Phase 1 / Phase 2.
- Sliding-window expiry beyond bumping `last_seen_at`. Idle timeout is out of scope.
- Multi-region or distributed session caches.
- Replacing the plaintext `device_sessions.access_token` storage. That is a debt Phase 2 must clear; Phase 0 leaves it alone.
- Email-based session security signals.

## Key Design Choices

| Choice | Decision | Rationale |
|---|---|---|
| Where admin sessions live | New `admin_sessions` table | `device_sessions` is matrix-bound and carries fields that have no meaning for admin sessions; mixing the two would make Phase 2 (`/api/oauth/refresh`, device session list) harder to reason about. |
| Token storage form | SHA-256 hash, never plaintext | A DB leak should not equal active admin sessions. The fact that `device_sessions` stores plaintext is a debt to repay in Phase 2, not a pattern to extend. |
| Migration runner | Scan `migrations/*.sql`, sort lexicographically, run every file inside `migratePostgres` | Existing DDL is fully `IF NOT EXISTS`, so re-execution is idempotent. No `schema_migrations` tracking table needed yet; reach for one only when a non-idempotent migration appears. |
| `validate(token)` failure mode | Throws `AdminAuthenticationError`; route layer maps to HTTP 401 | The route already wraps everything in `try/catch`. Throwing keeps `requireAdmin` a single line and removes "valid-looking token, nullish user" branches downstream. The error class lets `errorResponse` route 401 without regex-matching messages. |

## Architecture

```
┌────────────────────┐   Bearer plain-token        ┌──────────────────────────┐
│ admin web (Vue)    │ ───────────────────────────▶│ routes.ts                │
│  - localStorage    │                             │  requireAdmin(req)       │
└────────────────────┘                             └────────────┬─────────────┘
                                                                │
                                                                ▼
                                           ┌──────────────────────────────────┐
                                           │ adminSessionService              │
                                           │   login(...)      [persists]     │
                                           │   validate(token) [throws / OK]  │
                                           │   revoke(token)   [Phase 1 stub] │
                                           └────────────┬─────────────────────┘
                                                        │ sha256(token)
                                                        ▼
                                           ┌──────────────────────────────────┐
                                           │ EnterpriseRepository             │
                                           │   createAdminSession             │
                                           │   findAdminSessionByTokenHash    │
                                           │   touchAdminSession              │
                                           │   revokeAdminSession             │
                                           │   findUserById                   │
                                           └────────────┬─────────────────────┘
                                                        │
                                                        ▼
                                              admin_sessions (Postgres)
```

## Schema

New migration `apps/api/src/db/migrations/0002_admin_sessions.sql`:

```sql
CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token_hash TEXT NOT NULL UNIQUE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_user
  ON admin_sessions (organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at
  ON admin_sessions (expires_at);
```

`refresh_token_hash` is populated now even though refresh is not implemented in Phase 0. Storing it removes a future migration when Phase 1/2 wires refresh in. The plaintext `refreshToken` is still returned in the `/api/admin/login` response — that field is part of the `MuonSession` contract — but no endpoint accepts it yet, so today it is simply unused on the client.

## Repository Interface Changes

Add five methods to `EnterpriseRepository` (`apps/api/src/repository.ts`):

```ts
interface CreateAdminSessionInput {
  organizationId: string
  userId: string
  accessTokenHash: string
  refreshTokenHash: string
  expiresAt: string
}

interface AdminSessionRecord {
  id: string
  organizationId: string
  userId: string
  accessTokenHash: string
  refreshTokenHash: string
  expiresAt: string
  revokedAt: string | null
  createdAt: string
  lastSeenAt: string
}

createAdminSession(input: CreateAdminSessionInput): Promise<AdminSessionRecord>
findAdminSessionByTokenHash(hash: string): Promise<AdminSessionRecord | null>
touchAdminSession(id: string): Promise<void>                 // updates last_seen_at
revokeAdminSession(id: string): Promise<void>                // sets revoked_at
findUserById(orgId: string, userId: string): Promise<EnterpriseUserRecord | null>
```

Both the Postgres repository and the in-memory repository must implement them. `findUserById` is added because `validate` needs to fetch the user behind a session, and the existing repository only exposes `findUserByUsername`.

## Service Changes

`apps/api/src/modules/auth/adminSessionService.ts`:

- Add an exported `class AdminAuthenticationError extends Error`.
- `login()` change: after `verifyPassword`, hash both tokens with SHA-256 and call `repository.createAdminSession(...)` with an 8-hour `expiresAt`. The plaintext tokens are returned to the caller as before.
- New `validate(token: string): Promise<EnterpriseUserRecord>`:
  - Hash the token.
  - `findAdminSessionByTokenHash`. Missing → `throw new AdminAuthenticationError('Admin authentication required')`.
  - Check `revokedAt === null` and `expiresAt > now`. Either fails → throw the same error.
  - `touchAdminSession(session.id)` (fire-and-forget; failures here must not fail the request).
  - `findUserById(session.organizationId, session.userId)`. Missing or `status !== 'active'` → throw the same error.
  - Return the user.
- New `revoke(token: string): Promise<void>`: hash, look up, set `revoked_at`. Idempotent — unknown or already-revoked tokens are no-ops. Wired in Phase 1, but added now so Phase 0 lands with the service surface complete.

## Route Changes

`apps/api/src/routes.ts`:

- Delete the `adminTokens` Map and the closure-scoped `requireAdmin` reading from it.
- `requireAdmin(request)` becomes:
  ```ts
  async function requireAdmin(request: Request) {
    const token = bearerToken(request)
    if (!token) throw new AdminAuthenticationError('Admin authentication required')
    return adminSessionService.validate(token)
  }
  ```
- `POST /api/admin/login`: no longer touches the (now-removed) Map; the service already persists.
- `errorResponse(error)`: extend to map `AdminAuthenticationError` to status 401.

## Migration Runner

`apps/api/src/db/postgresRepository.ts → migratePostgres(pool)`:

- Use `fs.readdir(new URL('./migrations/', import.meta.url))` to list `*.sql` files.
- Sort lexicographically.
- Execute each as a single `pool.query()`. All current DDL is `IF NOT EXISTS`, so re-running is safe.

## Frontend Changes (D1)

`apps/admin/src/api.ts`:

```ts
export function getAdminMe(token: string): Promise<{ user: EnterpriseUser }> {
  return request('/api/admin/me', {
    headers: { authorization: `Bearer ${token}` },
  })
}
```

`apps/admin/src/AdminApp.vue`:

- At the bottom of `<script setup>`, replace the bare `if (adminToken.value) void refreshDashboard()` with:
  ```ts
  async function bootstrap() {
    const token = adminToken.value
    if (!token) return
    try {
      await getAdminMe(token)
      await refreshDashboard()
    }
    catch (err) {
      if (isAuthenticationError(err)) clearAdminToken()
      else userError.value = err instanceof Error ? err.message : '加载后台数据失败'
    }
  }
  void bootstrap()
  ```
- `isAuthenticationError` is already defined in the file and matches `authentication|credentials|required`. The new 401 response body `{"error":"Admin authentication required"}` matches `/required/`, so no regex change is needed.

## Error Handling

| Condition | Backend response | Admin frontend behavior |
|---|---|---|
| No `Authorization` header | 401, `{"error":"Admin authentication required"}` | bootstrap clears token, falls back to login screen |
| Token hash not found | 401 (same) | same |
| Token revoked or expired | 401 (same) | same |
| User `status='disabled'` while session still active | 401 (same) | same — disabling a user effectively logs them out |
| `touchAdminSession` DB error | logged, request continues | n/a |
| `findUserById` DB error (not "not found") | 500, generic message | error banner; token kept |

## Testing

**Unit (`apps/api`, run with `pnpm test:unit`):**

- `adminSessionService.login` persists a session whose plaintext token immediately `validate`s.
- `validate` throws for: missing token, unknown hash, revoked session, expired session, disabled user.
- `validate` updates `last_seen_at` on success.
- `revoke` is idempotent (call twice — second call succeeds with no effect).
- `migratePostgres` is idempotent across two consecutive invocations.

**Integration:**

- Boot the API, log in, save the access token, restart the API process, hit `/api/admin/me` with the saved token → 200. This is the regression test for the "Map lost on restart" failure mode.

**Frontend (`tests/components/AdminApp.test.ts`):**

- Mount with a stored token, `getAdminMe` resolves → dashboard visible, no login form.
- Mount with a stored token, `getAdminMe` rejects with 401-shaped error → localStorage cleared, login form visible.
- Mount with no stored token → login form visible, `getAdminMe` not called.

## Risks

- **One-time forced logout** — every existing admin session in the in-memory Map is invalidated by the deploy. With current user count this is acceptable; release notes should mention it.
- **Latent debt: `device_sessions.access_token` stays plaintext** — Phase 0 does not touch it. Phase 2 must, and the spec for Phase 2 must call this out explicitly.
- **`touchAdminSession` write amplification** — every authenticated request now does a write. At current request volumes (single-digit QPS) this is negligible; if the admin console ever grows beyond that, batch or sample.

## Open Questions

- None blocking Phase 0. Phase 1 will need to decide whether `logout` revokes only the current session or all sessions for the user; that decision belongs to Phase 1's spec.
