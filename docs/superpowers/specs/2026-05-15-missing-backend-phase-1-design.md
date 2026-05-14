# Missing Backend — Phase 1: Admin Credential Lifecycle

Date: 2026-05-15

## Context

Phase 0 made admin sessions persistent and validated through `adminSessionService`. Phase 1 builds on that foundation to close three gaps that the original audit identified:

- **A1** — `POST /api/admin/logout`: the admin web "退出登录" button currently only clears `localStorage`, leaving the server-side session active until it expires.
- **A2** — `POST /api/admin/me/password`: users marked `mustChangePassword=true` (the default for every freshly-created user) have no in-product way to clear that flag. The badge shows up in the UI; the workflow does not exist.
- **B3** — `oauthService.loginAndCreateCode` and the must-change-password gate: a user with `mustChangePassword=true` can today receive a desktop OAuth code and an admin web token that lets them call every admin endpoint. The flag is decorative.

These three changes together form "admin credential lifecycle".

## Goal

After Phase 1:

- An admin web session can be terminated at the server, not just at the client.
- A user can change their own password from inside the admin web, the canonical flow for clearing `mustChangePassword`.
- Holding `mustChangePassword=true` actually limits what a session can do: only `/api/admin/me` and `/api/admin/me/password` answer; everything else returns HTTP 403 with a machine-readable `must_change_password` code.
- Desktop OAuth login refuses `mustChangePassword=true` users with the same error code, directing them to change their password via admin web first.
- Successfully changing a password kicks every other admin session for that user. The session that performed the change stays.

## Non-Goals

- A separate "limited token" type. Phase 1 keeps a single token type and gates by `user.mustChangePassword` at the route layer.
- "Log out everywhere" as a separate action. Logout revokes only the current session in Phase 1. Phase 2 may add a "revoke all my sessions" surface if needed.
- Self-service password reset by email. The Phase 0 spec (`2026-05-02-enterprise-auth-admin-design.md`) explicitly excludes email flows.
- A desktop-side change-password UI. Desktop refuses `mustChangePassword=true` logins with a clear error; the user resolves it on admin web.
- Password strength policies beyond the existing `z.string().min(12)` rule.
- Audit-log filtering of which session id was kept vs. revoked beyond a count. Phase 3 will cover audit visibility.

## Key Design Choices

| Choice | Decision | Rationale |
|---|---|---|
| Where to gate `mustChangePassword` | New helper `requireFullyAuthorizedAdmin` in `routes.ts`, used by every admin route except `/api/admin/me` and `/api/admin/me/password` | `validate(token)` stays single-purpose (token → user). The route layer is the right place to decide which paths the limited token can hit, and which routes are exempt is then visible by grep. |
| `MustChangePasswordError` HTTP status | 403 + body `{"error":"must_change_password"}` | 401 means "no/bad credentials" — we have valid credentials. 403 means "credentials OK, action denied" — accurate. The machine-readable code lets the frontend distinguish from generic forbiddens. |
| Self-change-password requires `currentPassword` | Yes | Standard OWASP guidance. Defends against stolen-token-changes-password-locks-account. Even in the `mustChangePassword` state the user knows the password they just used to log in. |
| Logout scope | Only the current session | Matches user expectation of "退出登录". A "logout everywhere" feature is a separate action; YAGNI for Phase 1. |
| Other sessions on password change | Revoke all other admin sessions for the same user; keep the current one | Standard credential-change practice. Current session stays because the user just proved control. |
| `revokeOthersForUser` access path | New service method, hashes the current token, finds its session id, then calls a new repository batch-revoke | One extra DB round-trip per password change is negligible. Keeps `validate(token)` return type unchanged so other callers stay simple. |

## Architecture

```
Browser
  │ POST /api/admin/users  (any non-me route, examples)
  │ Authorization: Bearer <token>
  ▼
routes.ts
  │
  ├── requireFullyAuthorizedAdmin(req)            [new]
  │     │
  │     ├── requireAdmin(req)                     [existing]
  │     │     ↳ adminSessionService.validate(token)
  │     │       ↳ returns user
  │     │
  │     └── if (user.mustChangePassword)
  │             throw new MustChangePasswordError()
  │
  └── (route body — uses user normally)

errorResponse(err)
  ├── err instanceof AdminAuthenticationError  → 401
  ├── err instanceof MustChangePasswordError  → 403, {"error":"must_change_password"}
  └── ... existing 400/409 branches ...
```

Routes that stay on the bare `requireAdmin`:

- `GET  /api/admin/me`
- `POST /api/admin/me/password` (Phase 1, new)
- `POST /api/admin/logout` (Phase 1, new)

Every other admin route (`GET/POST /api/admin/organizations`, `GET/POST /api/admin/users`, `PATCH /api/admin/users/:id`, `POST /api/admin/users/:id/password`, `GET /api/admin/audit-logs`) switches to `requireFullyAuthorizedAdmin`.

## New Endpoints

### `POST /api/admin/logout`

- **Auth:** `requireAdmin` (allows `mustChangePassword` users — they may want to abandon the forced-change state)
- **Body:** empty
- **Action:** `adminSessionService.revoke(token)` (already exists, Phase 0), audit `admin.logout`
- **Response:** `200 { ok: true }`
- **Idempotency:** calling twice with the same now-revoked token returns 401 on the second call (because `validate` rejects revoked sessions); calling with a never-valid token returns 401. The frontend is best-effort: always clear localStorage regardless of response.

### `POST /api/admin/me/password`

- **Auth:** `requireAdmin` (allows `mustChangePassword` users — this IS the escape hatch)
- **Body:** `{ currentPassword: string, newPassword: string (min 12) }`
- **Validation:** `changeOwnPasswordRequestSchema` (new in `@muon/enterprise-contracts`)
- **Action:** `userService.changeOwnPassword(user, currentPassword, newPassword, currentToken)`:
  1. `verifyPassword(currentPassword, user.passwordHash)`; mismatch → 400 `Invalid credentials`
  2. `repository.resetUserPassword(orgId, user.id, { passwordHash: hashed, mustChangePassword: false })` (reuses Phase 0 method)
  3. `adminSessionService.revokeOthersForUser(currentToken)` (new):
     - `hash = sha256(token)`
     - `session = repository.findAdminSessionByTokenHash(hash)` — Phase 0 method
     - `repository.revokeAllAdminSessionsForUserExcept(session.organizationId, session.userId, session.id)` (new)
  4. `appendAuditLog({ action: 'user.password_changed', actorUserId: user.id, targetId: user.id })`
  5. Return `repository.getPublicUser(updatedUser)`
- **Response:** `200 { user: EnterpriseUser }`

## Repository Interface Changes

Add one method to `EnterpriseRepository`:

```ts
revokeAllAdminSessionsForUserExcept: (
  organizationId: string,
  userId: string,
  exceptSessionId: string,
) => Promise<void>
```

**In-memory implementation:** iterate `adminSessions`, for each session matching `(organizationId, userId)`, `id !== exceptSessionId`, and `revokedAt === null`, set `revokedAt = nowIso()`.

**Postgres implementation:**

```sql
UPDATE admin_sessions
   SET revoked_at = $4
 WHERE organization_id = $1
   AND user_id = $2
   AND id <> $3
   AND revoked_at IS NULL
```

No migration needed — the table from Phase 0 already has every column we need.

## Service Changes

### `adminSessionService.ts`

Add a new exported error class alongside `AdminAuthenticationError`:

```ts
export class MustChangePasswordError extends Error {
  readonly code = 'must_change_password'
  constructor(message = 'Password must be changed before continuing') {
    super(message)
    this.name = 'MustChangePasswordError'
  }
}
```

Extend `AdminSessionService` with:

```ts
revokeOthersForUser: (currentToken: string) => Promise<void>
```

Implementation: hash, look up session, no-op if missing or revoked, otherwise call the new repository batch-revoke.

### `userService.ts`

Add to `UserService`:

```ts
changeOwnPassword: (
  user: EnterpriseUserRecord,
  input: ChangeOwnPasswordRequest,
) => Promise<EnterpriseUser>
```

The `currentToken` does not need to be threaded through `userService` — the route handler will call `adminSessionService.revokeOthersForUser(token)` explicitly after `userService.changeOwnPassword` returns. This keeps `userService` free of session-management concerns.

Implementation:
1. Parse via `changeOwnPasswordRequestSchema`
2. `verifyPassword(input.currentPassword, user.passwordHash)`; on failure throw `Error('Invalid credentials')` (which `errorResponse` maps to 400 via the existing regex)
3. `repository.resetUserPassword(user.organizationId, user.id, { passwordHash: await hashPassword(input.newPassword), mustChangePassword: false })`
4. `appendAuditLog({ organizationId, actorUserId: user.id, action: 'user.password_changed', targetType: 'user', targetId: user.id })`
5. Return `repository.getPublicUser(updated)`

### `oauthService.ts`

In `loginAndCreateCode`, after `findActiveUser` succeeds:

```ts
if (user.mustChangePassword)
  throw new MustChangePasswordError()
```

No other oauthService changes.

## Contract Additions

In `packages/enterprise-contracts/src/schemas.ts`:

```ts
export const changeOwnPasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12),
})
export type ChangeOwnPasswordRequest = z.infer<typeof changeOwnPasswordRequestSchema>
```

Exported via `packages/enterprise-contracts/src/index.ts` alongside the rest.

## Route Changes (`routes.ts`)

1. Add `MustChangePasswordError` to the existing import line for `adminSessionService`.
2. Add `requireFullyAuthorizedAdmin`:
   ```ts
   async function requireFullyAuthorizedAdmin(request: Request): Promise<EnterpriseUserRecord> {
     const user = await requireAdmin(request)
     if (user.mustChangePassword)
       throw new MustChangePasswordError()
     return user
   }
   ```
3. Switch the following routes from `requireAdmin` to `requireFullyAuthorizedAdmin`:
   - `GET/POST /api/admin/organizations`
   - `GET/POST /api/admin/users`
   - `PATCH /api/admin/users/:id`
   - `POST /api/admin/users/:id/password`
   - `GET /api/admin/audit-logs`
4. Leave `requireAdmin` in place for:
   - `GET /api/admin/me`
   - `POST /api/admin/me/password` (new)
   - `POST /api/admin/logout` (new)
5. Add handlers for the two new endpoints (specifics in the implementation plan).
6. Extend `errorResponse`:
   ```ts
   if (error instanceof MustChangePasswordError)
     return jsonResponse({ error: error.code }, { status: 403 })
   ```
   Note the body uses `error.code` (`"must_change_password"`), not the human message — frontend will switch on the code.

## Frontend Changes (Admin Web)

### `apps/admin/src/api.ts` additions

```ts
export function logoutAdmin(token: string): Promise<{ ok: true }> {
  return request('/api/admin/logout', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  })
}

export function changeOwnPassword(
  token: string,
  input: ChangeOwnPasswordRequest,
): Promise<{ user: EnterpriseUser }> {
  return request('/api/admin/me/password', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  })
}
```

### `apps/admin/src/AdminApp.vue` changes

**State additions:**

```ts
const mustChangePassword = ref(false)
const changePasswordForm = reactive({ currentPassword: '', newPassword: '' })
const changePasswordSubmitting = ref(false)
const changePasswordError = ref('')
```

**Bootstrap update:**

```ts
async function bootstrap() {
  const token = adminToken.value
  if (!token) return
  try {
    const { user } = await getAdminMe(token)
    if (user.mustChangePassword) {
      mustChangePassword.value = true
      return
    }
    await refreshDashboard()
  } catch (err) {
    if (isAuthenticationError(err)) clearAdminToken()
    else userError.value = err instanceof Error ? err.message : '加载后台数据失败'
  }
}
```

**Logout update:**

```ts
async function logout() {
  const token = adminToken.value
  if (token) {
    try { await logoutAdmin(token) }
    catch { /* best-effort: server may already have invalidated */ }
  }
  clearAdminToken()
}
```

Wire `logout()` to the existing `data-testid="logout-admin"` button instead of `clearAdminToken` directly.

**Forced change-password overlay:**

When `mustChangePassword.value === true`, render an overlay (`<section class="force-change-password-overlay">`) that:
- Is fixed-position, covers the dashboard, prevents interaction with anything behind it.
- Contains a heading: "首次登录,请修改初始密码".
- Has two inputs: currentPassword (autocomplete="current-password"), newPassword (autocomplete="new-password", placeholder includes ">= 12 位").
- A primary button: "保存新密码". On submit:
  1. Call `changeOwnPassword(token, form)`.
  2. On success, refresh `getAdminMe(token)`, set `mustChangePassword.value = false`, call `refreshDashboard()`. Reset form fields.
  3. On error, populate `changePasswordError`.
- A secondary "退出登录" link in the corner that calls `logout()` (so the user is not fully trapped).

**Template gate:**

Wrap the existing `<section v-else class="admin-content dashboard-layout">` content so it does NOT render while `mustChangePassword.value === true`. The overlay sits on top of the existing layout; the dashboard data is not loaded (no `refreshDashboard` was called) so there is nothing meaningful to see anyway.

## Error Handling

| Condition | Backend response | Frontend behavior |
|---|---|---|
| Logout with valid token | 200 `{ ok: true }` | Clear localStorage, navigate to login |
| Logout with revoked token | 401 (validate rejects) | Clear localStorage anyway (best-effort) |
| Change own password, wrong currentPassword | 400 `{"error":"Invalid credentials"}` | Show inline error in overlay |
| Change own password, weak newPassword | 400 zod parse error | Show inline error |
| Change own password, success | 200 `{ user: { ...mustChangePassword: false } }` | Hide overlay, refresh dashboard |
| Non-me endpoint with must-change token | 403 `{"error":"must_change_password"}` | Should not happen — overlay prevents these calls. Defensive: re-bootstrap to see the overlay. |
| Desktop OAuth login while must-change | 403 `{"error":"must_change_password"}` | Desktop client shows: "Please change your password via the admin web before signing in here." |

## Testing

**Backend unit (in `tests/unit/enterprise/`):**

- `userService.changeOwnPassword` (new file `userServiceChangeOwnPassword.test.ts`):
  - happy path: valid current password → mustChangePassword cleared, can re-login with new password
  - wrong current password → throws `Invalid credentials`
  - weak new password → zod throws
- `adminSessionService.revokeOthersForUser` (extend `adminSessionService.test.ts`):
  - revokes other sessions for same user; current session stays valid
  - no-op for unknown token, no throw
  - does not touch sessions of other users
- `apiRoutes.test.ts` extensions:
  - `POST /api/admin/logout` → 200, subsequent calls with same token → 401
  - `POST /api/admin/me/password` happy path → 200, mustChangePassword cleared
  - `POST /api/admin/me/password` with wrong currentPassword → 400
  - GET `/api/admin/organizations` with mustChangePassword user → 403 with code `must_change_password`
  - GET `/api/admin/me` with mustChangePassword user → 200 (verify the bypass)
  - POST `/api/admin/me/password` flow: must-change user → submits new password → other admin sessions for that user are now revoked
- `oauthDesktopFlow.test.ts` extension:
  - `loginAndCreateCode` with mustChangePassword user → throws `MustChangePasswordError`

**Frontend (in `tests/components/AdminApp.test.ts`):**

- Bootstrap with mustChangePassword=true → overlay visible, dashboard not loaded, `refreshDashboard` not called.
- Submit valid currentPassword/newPassword in overlay → `changeOwnPassword` called, overlay hides, `refreshDashboard` called.
- Submit wrong currentPassword → overlay stays, error message displayed.
- "退出登录" link in overlay → `logoutAdmin` called, token cleared, login form visible.
- Existing logout button → `logoutAdmin` called before localStorage cleared.

## Risks

- **A user who forgets their current password during force-change cannot self-recover.** Phase 1 has no email-reset flow. Mitigation: another admin can call `POST /api/admin/users/:id/password` to reset for them.
- **`requireFullyAuthorizedAdmin` is opt-in.** A future endpoint added by mistake on `requireAdmin` instead of `requireFullyAuthorizedAdmin` would silently allow must-change users through. Mitigation: a single grep audit before merging Phase 1; the route file is small enough that the entire list is visible at once.
- **`logoutAdmin` is best-effort by design.** A network failure during logout silently keeps the server session alive (it will still expire after 8h). Acceptable for Phase 1.

## Open Questions

- None blocking Phase 1. Phase 2 will need to think about whether OAuth desktop sessions deserve the same must-change-password gate at *every* device-session request (today the gate only checks at `loginAndCreateCode` time). For Phase 1 that is fine — Phase 0 already revokes admin sessions when must-change is set on the user record, and the OAuth side cannot reset the flag, so a desktop session created before the user was marked must-change remains.
