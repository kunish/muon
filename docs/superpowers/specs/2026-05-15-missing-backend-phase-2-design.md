# Missing Backend — Phase 2: Desktop OAuth Session Lifecycle

Date: 2026-05-15

## Context

Phases 0 and 1 stabilized the admin web side: sessions persist, must-change-password is enforced, logout and self-change-password work. Phase 2 turns to the **desktop OAuth flow**, which has been half-built since the 2026-05-02 enterprise auth design:

- `MuonSession.refreshToken` is contracted, generated, and stored — but no endpoint consumes it.
- `device_sessions.access_token` is stored as plaintext, but nothing validates it.
- Admins have no way to see or revoke a user's desktop sessions.
- The desktop client, after the first OAuth login, never talks to the muon API again.

The four pieces Phase 2 ships:

- **A3** — `POST /api/oauth/refresh`: desktop uses the refresh token to roll forward.
- **C1** — `GET / DELETE /api/admin/users/:userId/sessions`: admin can audit and revoke.
- **device_sessions plaintext token cleanup** — drop and replace with `access_token_hash`.
- **Desktop auto-refresh on startup near expiry** — the only desktop-side automation in this phase.

## Goal

After Phase 2:

- Desktop sessions are renewable for 30 days without re-login, by rotating refresh tokens.
- Admins can list active desktop sessions per user and kill them.
- `device_sessions` stops storing plaintext access tokens.
- The desktop client refreshes its enterprise session on startup when within 24h of expiry, transparently to the user.

## Non-Goals (explicit, because Q6 surfaced a tempting overreach)

- **Re-provisioning matrix credentials on refresh.** Today's `conduitAdapter.ensureUser` is create-only (it calls `/_matrix/client/v3/register`, which rejects existing users with `M_USER_IN_USE`). To reissue a matrix device token for an existing user we would need a new conduit adapter method, plus conduit-side support for either admin login-as-user or device token reset. Neither is currently available. So Phase 2 refresh **rotates only the muon access/refresh token pair; matrixSession is the same one stored in `matrix_accounts`, re-attached to the response.**
- **Killing the matrix session when admin revokes a device session.** Same root cause — we don't have a matrix-side revocation primitive. Admin revoking a device session today only blocks future muon refresh; the user's matrix client keeps working until their matrix token naturally expires or matrix admin intervenes. Phase 5+ may extend the adapter with `revokeDevice`.
- **A new "limited token" type for refresh-only use.** A single token type with `revoked_at` semantics is enough.
- **Hooking `matrix-js-sdk` 401 handlers to drive refresh.** Phase 2 only refreshes on startup near expiry. Mid-session refresh is Phase 3+ work.
- **Matrix account migration to hashed access tokens.** `matrix_accounts.access_token` stays plaintext because the muon API forwards it directly to conduit on authenticated calls. That column is a different debt with a different solution path; not in this phase.
- **A "logout everywhere" admin endpoint.** Single-session revoke is enough for Phase 2.
- **Self-service device session viewing for end users.** Only admins see device sessions in Phase 2.

## Key Design Choices

| Choice | Decision | Rationale |
|---|---|---|
| Refresh response shape | `{ muonSession (new), matrixSession (existing, re-attached) }` | The user explicitly accepted the "honest" tradeoff in Q6 after the conduit adapter limitation surfaced. Keeps Phase 2 tractable; matrix-side revocation is deferred. |
| Refresh token rotation | Strict — each refresh creates a new `device_sessions` row, revokes the old | OAuth 2.1 best practice; replays of stolen refresh tokens fail on the second call, surfacing the compromise. |
| `device_sessions.access_token` migration | `DELETE FROM device_sessions; DROP COLUMN access_token; ADD COLUMN access_token_hash` | No production users; existing rows have no consumer. The cleanest path is a hard reset of the schema; the cost is desktops that already have a session will be told to re-OAuth, which is the same failure mode as a refresh-token revocation — already a path users may hit. |
| Admin device session API | List + single revoke (`GET .../sessions`, `DELETE .../sessions/:sessionId`) | A "revoke all" endpoint is YAGNI for Phase 2; existing single-revoke handles compromised-device flows fine. |
| Desktop refresh trigger | Startup-only, when `expiresAt - now < 24h` | Keeps Phase 2 free of `matrix-js-sdk` integration. Mid-session 401 retry is Phase 3+ work. |
| Admin UI device session loading | On-demand per user (lazy expand) | A user could have many sessions over time; pre-loading every user's sessions on dashboard refresh adds avoidable load. |
| Audit action naming | Rename `oauth.token.exchanged` → `oauth.token.issued`; new `oauth.token.refreshed` | The Phase 3 audit log filter spec needs distinct action codes for "first issuance" vs "refresh"; settle the naming now so Phase 3 doesn't migrate audit rows. |

## Architecture

```
Desktop (Electron)                                Muon API                              Postgres
─────────────────                                 ─────────                              ────────
restoreSession() on startup
  └─ maybeRefreshOnStartup()
       (expiresAt − now < 24h)
       │
       ▼
   POST /api/oauth/refresh ─────────────────────▶ routes.ts
   body: { refreshToken,                              │
           clientId: 'muon-desktop',                  ▼
           deviceName: 'Muon Desktop' }          oauthService.refresh
                                                      │
                                                      ├─ hash(refreshToken)
                                                      ├─ findDeviceSessionByRefreshTokenHash
                                                      │     ✗ not found → 400 'Invalid refresh token'
                                                      │     ✗ revoked or expired → 400 same
                                                      │
                                                      ├─ findMatrixAccount(orgId, userId)
                                                      │     ✗ missing → 500 (data integrity)
                                                      │
                                                      ├─ generate new access + refresh tokens
                                                      ├─ createDeviceSession (new row)         ───▶ INSERT
                                                      ├─ revokeDeviceSession (old row)         ───▶ UPDATE revoked_at
                                                      ├─ appendAuditLog 'oauth.token.refreshed' ───▶ INSERT
                                                      │
                                                      ▼
                                                response: {
                                                  muonSession: { accessToken (new),
                                                                 refreshToken (new),
                                                                 expiresAt (now + 30d) },
                                                  matrixSession: { ...the existing one, unchanged }
                                                }

Admin web                                        Muon API
─────────                                        ─────────
GET /api/admin/users/:userId/sessions ─────────▶ routes.ts.requireFullyAuthorizedAdmin
                                                      └─ repository.findActiveDeviceSessionsByUser
                                                            ───▶ SELECT WHERE revoked_at IS NULL
                                                                       AND expires_at > NOW()
                                                                 returns id, deviceName, createdAt, expiresAt

DELETE /api/admin/users/:userId/sessions/:id ──▶ routes.ts.requireFullyAuthorizedAdmin
                                                      └─ repository.revokeDeviceSession(id)
                                                            ───▶ UPDATE revoked_at = COALESCE(...)
                                                            audit 'device_session.revoked'
```

## Schema

New migration `apps/api/src/db/migrations/0003_device_sessions_hash_access_token.sql`:

```sql
-- No production users; existing rows have no consumer. Reset cleanly.
DELETE FROM device_sessions;

ALTER TABLE device_sessions DROP COLUMN access_token;
ALTER TABLE device_sessions ADD COLUMN access_token_hash TEXT NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_sessions_access_hash
  ON device_sessions (access_token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_sessions_refresh_hash
  ON device_sessions (refresh_token_hash);
```

The `idx_device_sessions_refresh_hash` index didn't exist before; refresh-by-hash lookup will be common, so add it now.

## Repository Interface Changes

```ts
// DeviceSessionRecord field rename
- accessToken: string
+ accessTokenHash: string

// CreateDeviceSessionInput field rename
- accessToken: string
+ accessTokenHash: string

// New methods on EnterpriseRepository
findDeviceSessionByRefreshTokenHash: (refreshTokenHash: string) => Promise<DeviceSessionRecord | null>
findActiveDeviceSessionsByUser: (
  organizationId: string,
  userId: string,
) => Promise<DeviceSessionRecord[]>
revokeDeviceSession: (id: string) => Promise<void>  // idempotent
```

In-memory and Postgres implementations both update.

`findActiveDeviceSessionsByUser` returns only rows where `revoked_at IS NULL AND expires_at > now()`. Expired-but-not-revoked rows are NOT shown to admins (they're already effectively dead) and `revokeDeviceSession` on them is a 200 no-op.

## Contract Additions (`packages/enterprise-contracts/src/schemas.ts`)

```ts
export const oauthRefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
  clientId: z.string().min(1),
  deviceName: z.string().trim().min(1),
})
export type OAuthRefreshRequest = z.infer<typeof oauthRefreshRequestSchema>

export const deviceSessionSchema = z.object({
  id: z.string().min(1),
  deviceName: z.string().min(1),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
})
export type DeviceSessionPublic = z.infer<typeof deviceSessionSchema>
```

Refresh's response shape reuses `oauthTokenResponseSchema` — refresh returns the same `{ muonSession, matrixSession }` envelope as `exchangeCode`.

## Service Changes

### `oauthService.ts`

**`exchangeCode` modification:** hash the access token before saving. The plaintext continues to be returned to the client (it's `muonSession.accessToken`):

```ts
const accessToken = token()
const refreshToken = token()
const expiresAt = new Date(...).toISOString()
await repository.createDeviceSession({
  organizationId: ...,
  userId: ...,
  deviceName: request.deviceName,
  accessTokenHash: sha256(`access:${accessToken}`),   // ← changed
  refreshTokenHash: sha256(`refresh:${refreshToken}`),
  expiresAt,
})
```

Audit log action renamed `oauth.token.exchanged` → `oauth.token.issued`.

**New `refresh(input: OAuthRefreshRequest)` method:**

1. Parse via `oauthRefreshRequestSchema`.
2. `assertDesktopClient(clientId, redirectUri=DESKTOP_REDIRECT_URI)` — refresh uses the desktop client id only; redirectUri is implicit.

   *Caveat:* `assertDesktopClient` takes both clientId and redirectUri. For refresh, we don't have redirectUri in the request body; either pass the constant or relax assert to clientId only. **Recommendation:** add a second helper `assertDesktopClientId(clientId)` that checks only the id, used by refresh.

3. `repository.findDeviceSessionByRefreshTokenHash(sha256('refresh:' + input.refreshToken))`. Null → throw `Error('Invalid refresh token')` (errorResponse maps to 400 via existing regex).
4. Check `revokedAt === null` and `expiresAt > now`. Either fails → same error.
5. `repository.findMatrixAccount(session.organizationId, session.userId)`. Missing → throw `Error('Matrix account not found')` (500).
6. Generate new `accessToken` and `refreshToken`.
7. `repository.createDeviceSession({ ...same orgId/userId/deviceName, expiresAt = now + 30d ...})`.
8. `repository.revokeDeviceSession(oldSession.id)`.
9. `appendAuditLog({ action: 'oauth.token.refreshed', metadata: { previousSessionId: oldSession.id, newSessionId: newSession.id } })`.
10. Return `{ muonSession: { accessToken, refreshToken, expiresAt }, matrixSession: { serverUrl, userId, accessToken, deviceId } }` where matrixSession is built from the existing `matrix_accounts` row + `matrixServerUrl` constructor arg.

## Route Additions (`routes.ts`)

### `POST /api/oauth/refresh`

```ts
if (url.pathname === '/api/oauth/refresh') {
  if (request.method !== 'POST')
    return methodNotAllowed()
  const result = await oauthService.refresh(await readJsonBody(request) as never)
  return withCors(jsonResponse(result), request)
}
```

No `requireAdmin` — refresh is its own authentication. Errors map via existing `errorResponse`.

### `GET /api/admin/users/:userId/sessions`

```ts
const sessionsRoute = adminUserSessionsRoute(url.pathname)
if (sessionsRoute && !sessionsRoute.sessionId) {
  const actor = await requireFullyAuthorizedAdmin(request)
  if (request.method === 'GET') {
    const sessions = await repository.findActiveDeviceSessionsByUser(actor.organizationId, sessionsRoute.userId)
    return withCors(jsonResponse({
      sessions: sessions.map(toDeviceSessionPublic),
    }), request)
  }
  return methodNotAllowed()
}
```

`adminUserSessionsRoute` is a new path-match helper (mirrors `adminUserRoute`):

```ts
function adminUserSessionsRoute(pathname: string): { userId: string, sessionId?: string } | null {
  const match = /^\/api\/admin\/users\/([^/]+)\/sessions(?:\/([^/]+))?$/.exec(pathname)
  if (!match) return null
  return {
    userId: decodeURIComponent(match[1]),
    sessionId: match[2] ? decodeURIComponent(match[2]) : undefined,
  }
}
```

`toDeviceSessionPublic` strips hashes:

```ts
function toDeviceSessionPublic(record: DeviceSessionRecord): DeviceSessionPublic {
  return {
    id: record.id,
    deviceName: record.deviceName,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  }
}
```

### `DELETE /api/admin/users/:userId/sessions/:sessionId`

```ts
if (sessionsRoute && sessionsRoute.sessionId) {
  const actor = await requireFullyAuthorizedAdmin(request)
  if (request.method !== 'DELETE')
    return methodNotAllowed()
  await repository.revokeDeviceSession(sessionsRoute.sessionId)
  await repository.appendAuditLog({
    organizationId: actor.organizationId,
    actorUserId: actor.id,
    action: 'device_session.revoked',
    targetType: 'device_session',
    targetId: sessionsRoute.sessionId,
  })
  return withCors(jsonResponse({ ok: true }), request)
}
```

`revokeDeviceSession` is idempotent — calling it on an unknown id is a no-op success.

## Frontend Changes

### Admin Web (`apps/admin/src/api.ts`)

```ts
export function listUserDeviceSessions(token: string, userId: string): Promise<{ sessions: DeviceSessionPublic[] }> {
  return request(`/api/admin/users/${encodeURIComponent(userId)}/sessions`, {
    headers: { authorization: `Bearer ${token}` },
  })
}

export function revokeUserDeviceSession(token: string, userId: string, sessionId: string): Promise<{ ok: true }> {
  return request(`/api/admin/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  })
}
```

### Admin Web UI (`AdminApp.vue`)

Add lazy-loaded device-sessions panel per user. State additions:

```ts
const expandedSessions = reactive<Record<string, boolean>>({})
const userSessions = reactive<Record<string, DeviceSessionPublic[]>>({})
const sessionLoading = reactive<Record<string, boolean>>({})
const revokingSession = reactive<Record<string, boolean>>({})

async function toggleSessions(userId: string) {
  expandedSessions[userId] = !expandedSessions[userId]
  if (expandedSessions[userId] && !userSessions[userId]) {
    sessionLoading[userId] = true
    try {
      const { sessions } = await listUserDeviceSessions(adminToken.value, userId)
      userSessions[userId] = sessions
    }
    finally {
      sessionLoading[userId] = false
    }
  }
}

async function revokeSession(userId: string, sessionId: string) {
  revokingSession[sessionId] = true
  try {
    await revokeUserDeviceSession(adminToken.value, userId, sessionId)
    userSessions[userId] = (userSessions[userId] ?? []).filter(s => s.id !== sessionId)
  }
  finally {
    revokingSession[sessionId] = false
  }
}
```

Template: a `<details>` element after each user's reset-password form, with `<summary>` showing count and click-to-expand.

### Desktop (`src/matrix/auth.ts`)

**New helper `refreshEnterpriseSession`:**

```ts
const REFRESH_NEAR_EXPIRY_MS = 24 * 60 * 60 * 1000

export async function refreshEnterpriseSession(
  apiBaseUrl = import.meta.env.VITE_MUON_API_BASE_URL,
): Promise<void> {
  const baseUrl = enterpriseApiBaseUrl(apiBaseUrl)
  if (!baseUrl) return

  const stored = await readStoredMuonSession()
  if (!stored?.refreshToken) return

  const response = await fetch(`${baseUrl}/api/oauth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      refreshToken: stored.refreshToken,
      clientId: 'muon-desktop',
      deviceName: 'Muon Desktop',
    }),
  })

  if (!response.ok) {
    localStorage.removeItem(ENTERPRISE_SESSION_KEY)
    return
  }

  const payload = oauthTokenResponseSchema.parse(await response.json())
  await persistEnterpriseMuonSession(payload.muonSession)
  // matrixSession is unchanged from before; no need to re-persist it.
}
```

`readStoredMuonSession` and `persistEnterpriseMuonSession` are small extractions from the existing inline encrypt/decrypt blocks in `completeEnterpriseLogin`.

**Startup integration:**

`restoreSession()` calls `maybeRefreshOnStartup()` first:

```ts
async function maybeRefreshOnStartup(): Promise<void> {
  const stored = await readStoredMuonSession()
  if (!stored) return
  const msUntilExpiry = Date.parse(stored.expiresAt) - Date.now()
  if (msUntilExpiry < REFRESH_NEAR_EXPIRY_MS)
    await refreshEnterpriseSession().catch(() => {})
}

export async function restoreSession(): Promise<boolean> {
  await maybeRefreshOnStartup()
  // ... existing logic ...
}
```

## Error Handling

| Condition | Backend response | Desktop behavior | Admin web behavior |
|---|---|---|---|
| refreshToken not found | 400 `Invalid refresh token` | Clear `muon_enterprise_session`, force OAuth re-login | n/a |
| refreshToken revoked or expired | 400 (same) | Same | n/a |
| matrix_accounts missing | 500 (data integrity) | Keep session, retry on next start | n/a |
| GET sessions, user not in actor's org | 200 empty list (defensive) | n/a | Empty panel shown |
| DELETE sessions/:id with unknown id | 200 `{ ok: true }` | n/a | Panel refreshes |
| Any admin endpoint with must-change actor | 403 `must_change_password` | n/a | Inherits Phase 1 behavior |

## Testing

**Backend unit (in `tests/unit/enterprise/`):**

- `oauthRefresh.test.ts` (new):
  - happy path returns new tokens; old refresh token rejected on second use
  - revoked session rejected
  - expired session rejected
  - unknown token rejected
  - matrix account missing → 500-style error
  - audit log contains both old and new session ids
- `apiRoutes.test.ts` extensions:
  - `POST /api/oauth/refresh` happy path
  - `GET /api/admin/users/:userId/sessions` returns active sessions, hides hashes
  - `DELETE /api/admin/users/:userId/sessions/:sessionId` revokes (verified via subsequent GET)
  - `DELETE` with unknown sessionId → 200 idempotent
  - Both admin routes return 403 when actor has `mustChangePassword=true`
- `oauthDesktopFlow.test.ts` extension:
  - `exchangeCode` now stores `accessTokenHash` (verify via repository inspection)
  - Audit log shows `oauth.token.issued` after exchange (not `exchanged`)

**Frontend:**

- `AdminApp.test.ts`:
  - Toggling the sessions panel calls `listUserDeviceSessions` (lazy)
  - Toggling again doesn't refetch (cached locally)
  - Clicking "吊销" calls `revokeUserDeviceSession` and removes the row
- Desktop `auth.ts`:
  - `refreshEnterpriseSession` posts the stored refresh token and persists the new muonSession
  - `refreshEnterpriseSession` clears storage on 400 response
  - `maybeRefreshOnStartup` is a no-op when expiry is far away
  - `maybeRefreshOnStartup` triggers refresh when expiry is within 24h

## Risks

- **Phase 2 makes matrix-side revocation visibly absent.** The admin can now "revoke a device session" and watch as the desktop client continues to receive matrix messages. The admin UI should NOT promise more than the backend delivers. Spec lands the wording "已吊销 (matrix 端可能仍连接,Phase 5+ 完整化)" alongside revoke buttons.
- **Desktop refresh near expiry has a 24h window.** If the user opens the app exactly when their token expires (rare but possible), refresh will fail and they re-OAuth — same UX as a revocation. Acceptable.
- **`device_sessions` plaintext rows from before this migration are dropped.** Any session currently sitting in someone's localStorage will be told to re-OAuth. With current zero users this is benign, but mark in release notes.
- **`assertDesktopClient` currently checks both clientId and redirectUri.** Refresh body has no redirectUri. Need a refactor (extract `assertDesktopClientId`); see Service Changes section.

## Open Questions

- None blocking Phase 2. Phase 3+ will need to decide whether to surface device sessions to end users (self-service), at which point the admin-only API in Phase 2 may need an alias under `/api/me/sessions` or similar. Out of scope here.
