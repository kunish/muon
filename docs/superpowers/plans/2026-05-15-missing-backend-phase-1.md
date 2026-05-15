# Missing Backend — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin logout, self-change-password, and must-change-password enforcement; on the admin web, force users marked `mustChangePassword=true` through a change-password overlay before they can use any other UI.

**Architecture:** A new `requireFullyAuthorizedAdmin` route helper wraps `requireAdmin` and throws `MustChangePasswordError` when the user still owes a password change. Every admin route except `/api/admin/me`, `/api/admin/me/password`, and `/api/admin/logout` switches to it. `errorResponse` maps the new error to HTTP 403 with body `{"error":"must_change_password"}`. `userService.changeOwnPassword` verifies the current password, updates the hash, clears the flag; the route handler calls `adminSessionService.revokeOthersForUser` afterward so other devices lose their tokens. OAuth desktop login throws the same error when `mustChangePassword=true`.

**Tech Stack:** TypeScript, Node `node:http`, `pg`, zod, Vitest + `@vue/test-utils`, Vue 3, Postgres 16. Tests run via root `vitest.config.ts`.

**Reference spec:** `docs/superpowers/specs/2026-05-15-missing-backend-phase-1-design.md`

---

## File Structure

**Create:**
- `tests/unit/enterprise/userServiceChangeOwnPassword.test.ts` — self-change-password service tests

**Modify:**
- `packages/enterprise-contracts/src/schemas.ts` — add `changeOwnPasswordRequestSchema`
- `apps/api/src/repository.ts` — add `revokeAllAdminSessionsForUserExcept` to interface + in-memory impl
- `apps/api/src/db/postgresRepository.ts` — Postgres impl of the new repo method
- `apps/api/src/modules/auth/adminSessionService.ts` — add `MustChangePasswordError` class and `revokeOthersForUser` method
- `apps/api/src/modules/users/userService.ts` — add `changeOwnPassword` method
- `apps/api/src/modules/oauth/oauthService.ts` — gate `loginAndCreateCode` on `mustChangePassword`
- `apps/api/src/routes.ts` — `requireFullyAuthorizedAdmin`, two new endpoints, `errorResponse` extension, switch existing routes
- `apps/admin/src/api.ts` — `logoutAdmin`, `changeOwnPassword` clients
- `apps/admin/src/AdminApp.vue` — bootstrap detects must-change, forced overlay UI, logout wired server-side
- `tests/unit/enterprise/adminSessionService.test.ts` — extend with `revokeOthersForUser` tests
- `tests/unit/enterprise/apiRoutes.test.ts` — extend with logout, change-own-password, must-change gating tests
- `tests/unit/enterprise/oauthDesktopFlow.test.ts` — extend with must-change-password rejection
- `tests/components/AdminApp.test.ts` — add bootstrap-must-change, overlay-submit, logout-server-side tests

---

## Task 1: `MustChangePasswordError` class

Trivial: add the error class so later tasks can throw it.

**Files:**
- Modify: `apps/api/src/modules/auth/adminSessionService.ts`

- [ ] **Step 1: Add the class**

In `apps/api/src/modules/auth/adminSessionService.ts`, after the existing `AdminAuthenticationError` class declaration, add:

```ts
export class MustChangePasswordError extends Error {
  readonly code = 'must_change_password'
  constructor(message = 'Password must be changed before continuing') {
    super(message)
    this.name = 'MustChangePasswordError'
  }
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @muon/api build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/auth/adminSessionService.ts
git commit -m "feat(api): add MustChangePasswordError class"
```

---

## Task 2: `changeOwnPasswordRequestSchema` contract

Add the zod schema for the self-change-password request body. The package's `index.ts` re-exports `* from './schemas'`, so adding it to `schemas.ts` is enough — no extra export wiring.

**Files:**
- Modify: `packages/enterprise-contracts/src/schemas.ts`

- [ ] **Step 1: Append the schema**

At the end of `packages/enterprise-contracts/src/schemas.ts`, append:

```ts
export const changeOwnPasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12),
})
export type ChangeOwnPasswordRequest = z.infer<typeof changeOwnPasswordRequestSchema>
```

- [ ] **Step 2: Type-check the contracts package**

Run: `pnpm --filter @muon/enterprise-contracts build`
Expected: exit 0.

- [ ] **Step 3: Run full enterprise tests to confirm no regression**

Run: `pnpm test:enterprise`
Expected: PASS (61 tests).

- [ ] **Step 4: Commit**

```bash
git add packages/enterprise-contracts/src/schemas.ts
git commit -m "feat(contracts): add changeOwnPasswordRequestSchema"
```

---

## Task 3: Repository `revokeAllAdminSessionsForUserExcept`

Batch-revoke method for "password changed → kick other devices" flow. In-memory impl is exercised by tests; Postgres impl follows the existing pattern.

**Files:**
- Modify: `apps/api/src/repository.ts`
- Modify: `apps/api/src/db/postgresRepository.ts`
- Test: `tests/unit/enterprise/adminSessionRepository.test.ts` (extend)

- [ ] **Step 1: Append the failing test**

Append to `tests/unit/enterprise/adminSessionRepository.test.ts`:

```ts
describe('revokeAllAdminSessionsForUserExcept', () => {
  it('revokes all matching sessions except the one to keep', async () => {
    const { repository, install } = await setupInstalled()

    const keep = await repository.createAdminSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      accessTokenHash: 'keep-access',
      refreshTokenHash: 'keep-refresh',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })
    const dropA = await repository.createAdminSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      accessTokenHash: 'drop-a-access',
      refreshTokenHash: 'drop-a-refresh',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })
    const dropB = await repository.createAdminSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      accessTokenHash: 'drop-b-access',
      refreshTokenHash: 'drop-b-refresh',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })

    await repository.revokeAllAdminSessionsForUserExcept(install.organization.id, install.owner.id, keep.id)

    expect((await repository.findAdminSessionByTokenHash('keep-access'))?.revokedAt).toBeNull()
    expect((await repository.findAdminSessionByTokenHash('drop-a-access'))?.revokedAt).toBeTruthy()
    expect((await repository.findAdminSessionByTokenHash('drop-b-access'))?.revokedAt).toBeTruthy()

    void dropA
    void dropB
  })

  it('does not touch other users sessions', async () => {
    const { repository, install } = await setupInstalled()

    // Create a second user in the same org.
    const otherUser = await repository.createUser({
      organizationId: install.organization.id,
      username: 'other',
      email: 'other@acme.test',
      displayName: 'Other',
      passwordHash: 'fake-hash',
      status: 'active',
      mustChangePassword: false,
      roles: ['member'],
    })
    const otherSession = await repository.createAdminSession({
      organizationId: install.organization.id,
      userId: otherUser.id,
      accessTokenHash: 'other-access',
      refreshTokenHash: 'other-refresh',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })

    const ownerSession = await repository.createAdminSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      accessTokenHash: 'owner-keep-access',
      refreshTokenHash: 'owner-keep-refresh',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })

    await repository.revokeAllAdminSessionsForUserExcept(install.organization.id, install.owner.id, ownerSession.id)

    expect((await repository.findAdminSessionByTokenHash('other-access'))?.revokedAt).toBeNull()
    void otherSession
  })

  it('is idempotent — already-revoked sessions keep their original revokedAt', async () => {
    const { repository, install } = await setupInstalled()
    const session = await repository.createAdminSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      accessTokenHash: 'will-stay-revoked-access',
      refreshTokenHash: 'will-stay-revoked-refresh',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })
    await repository.revokeAdminSession(session.id)
    const firstRevokedAt = (await repository.findAdminSessionByTokenHash('will-stay-revoked-access'))?.revokedAt

    await new Promise(resolve => setTimeout(resolve, 5))
    // Bulk revoke with a different "except" id should not bump revokedAt.
    await repository.revokeAllAdminSessionsForUserExcept(install.organization.id, install.owner.id, 'unrelated-id')

    const afterRevokedAt = (await repository.findAdminSessionByTokenHash('will-stay-revoked-access'))?.revokedAt
    expect(afterRevokedAt).toBe(firstRevokedAt)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/enterprise/adminSessionRepository.test.ts`
Expected: FAIL — `revokeAllAdminSessionsForUserExcept is not a function`.

- [ ] **Step 3: Add interface entry**

In `apps/api/src/repository.ts`, inside the `EnterpriseRepository` interface (the file's existing entries are alphabetical-ish — place this near `revokeAdminSession`):

```ts
revokeAllAdminSessionsForUserExcept: (
  organizationId: string,
  userId: string,
  exceptSessionId: string,
) => Promise<void>
```

- [ ] **Step 4: Implement in-memory**

In `apps/api/src/repository.ts`, inside the object returned by `createInMemoryEnterpriseRepository`, add (near `revokeAdminSession`):

```ts
async revokeAllAdminSessionsForUserExcept(organizationId, userId, exceptSessionId) {
  const nowTimestamp = nowIso()
  for (const session of adminSessions) {
    if (session.organizationId !== organizationId) continue
    if (session.userId !== userId) continue
    if (session.id === exceptSessionId) continue
    if (session.revokedAt) continue
    session.revokedAt = nowTimestamp
  }
},
```

- [ ] **Step 5: Implement Postgres**

In `apps/api/src/db/postgresRepository.ts`, inside the object returned by `createPostgresEnterpriseRepository` (near the other `admin_sessions` methods), add:

```ts
async revokeAllAdminSessionsForUserExcept(organizationId: string, userId: string, exceptSessionId: string) {
  await pool.query(
    `UPDATE admin_sessions
        SET revoked_at = $4
      WHERE organization_id = $1
        AND user_id = $2
        AND id <> $3
        AND revoked_at IS NULL`,
    [organizationId, userId, exceptSessionId, nowIso()],
  )
},
```

- [ ] **Step 6: Type-check and run tests**

Run: `pnpm --filter @muon/api build`
Expected: exit 0.

Run: `pnpm vitest run tests/unit/enterprise/adminSessionRepository.test.ts`
Expected: PASS (10 tests — 7 existing + 3 new).

Run: `pnpm test:enterprise`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/repository.ts apps/api/src/db/postgresRepository.ts tests/unit/enterprise/adminSessionRepository.test.ts
git commit -m "feat(api): support batch-revoke admin sessions excepting one"
```

---

## Task 4: `adminSessionService.revokeOthersForUser`

Public API the route handler will call. Hashes the current token, finds its session, delegates to the repository batch-revoke.

**Files:**
- Modify: `apps/api/src/modules/auth/adminSessionService.ts`
- Test: `tests/unit/enterprise/adminSessionService.test.ts` (extend)

- [ ] **Step 1: Append failing tests**

Append to `tests/unit/enterprise/adminSessionService.test.ts`:

```ts
describe('adminSessionService.revokeOthersForUser', () => {
  it('revokes the user\'s other sessions but keeps the one identified by the current token', async () => {
    const { repository } = await setupOwner()
    const service = createAdminSessionService({ repository })

    const first = await service.login({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
    })
    const second = await service.login({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
    })

    await service.revokeOthersForUser(first.session.accessToken)

    // First (current) still validates.
    await expect(service.validate(first.session.accessToken)).resolves.toMatchObject({ username: 'owner' })

    // Second is now revoked.
    await expect(service.validate(second.session.accessToken)).rejects.toMatchObject({
      name: 'AdminAuthenticationError',
    })
  })

  it('is a silent no-op when the current token does not match any session', async () => {
    const { repository } = await setupOwner()
    const service = createAdminSessionService({ repository })
    await expect(service.revokeOthersForUser('not-a-token')).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/enterprise/adminSessionService.test.ts`
Expected: FAIL — `service.revokeOthersForUser is not a function`.

- [ ] **Step 3: Extend interface and add method**

In `apps/api/src/modules/auth/adminSessionService.ts`, extend the `AdminSessionService` interface (currently has `login`, `validate`, `revoke`):

```ts
export interface AdminSessionService {
  login: (input: AdminLoginRequest) => Promise<AdminSession>
  validate: (token: string) => Promise<EnterpriseUserRecord>
  revoke: (token: string) => Promise<void>
  revokeOthersForUser: (currentToken: string) => Promise<void>
}
```

Inside the object returned by `createAdminSessionService`, add (after `revoke`):

```ts
async revokeOthersForUser(currentToken) {
  if (!currentToken)
    return
  const session = await repository.findAdminSessionByTokenHash(sha256(currentToken))
  if (!session)
    return
  await repository.revokeAllAdminSessionsForUserExcept(session.organizationId, session.userId, session.id)
},
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/enterprise/adminSessionService.test.ts`
Expected: PASS (11 tests — 9 existing + 2 new).

Run: `pnpm test:enterprise`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/adminSessionService.ts tests/unit/enterprise/adminSessionService.test.ts
git commit -m "feat(api): support revoking other admin sessions for current user"
```

---

## Task 5: `userService.changeOwnPassword`

Self-service password change. Verifies current password, hashes new one, clears the `mustChangePassword` flag, audits.

**Files:**
- Modify: `apps/api/src/modules/users/userService.ts`
- Test: `tests/unit/enterprise/userServiceChangeOwnPassword.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/enterprise/userServiceChangeOwnPassword.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createInstallService } from '../../../apps/api/src/modules/install/installService'
import { createUserService } from '../../../apps/api/src/modules/users/userService'
import { createInMemoryEnterpriseRepository } from '../../../apps/api/src/repository'
import { verifyPassword } from '../../../apps/api/src/security/password'

async function setupOwner() {
  const repository = createInMemoryEnterpriseRepository()
  const install = await createInstallService({ repository }).install({
    organizationName: 'Acme',
    organizationSlug: 'acme',
    ownerUsername: 'owner',
    ownerEmail: 'owner@acme.test',
    ownerDisplayName: 'Owner',
    ownerPassword: 'correct horse battery staple',
  })
  return { repository, install }
}

describe('userService.changeOwnPassword', () => {
  it('updates the password hash, clears mustChangePassword, audits', async () => {
    const { repository, install } = await setupOwner()
    const service = createUserService({ repository })

    // Owner is created with mustChangePassword=true by installService.
    const ownerRecord = (await repository.findUserById(install.organization.id, install.owner.id))!
    expect(ownerRecord.mustChangePassword).toBe(true)

    const updated = await service.changeOwnPassword(ownerRecord, {
      currentPassword: 'correct horse battery staple',
      newPassword: 'a much better passphrase!',
    })

    expect(updated.mustChangePassword).toBe(false)

    const fresh = (await repository.findUserById(install.organization.id, install.owner.id))!
    expect(await verifyPassword('a much better passphrase!', fresh.passwordHash)).toBe(true)
    expect(await verifyPassword('correct horse battery staple', fresh.passwordHash)).toBe(false)

    expect(repository.auditLogs.some(event => event.action === 'user.password_changed' && event.actorUserId === ownerRecord.id)).toBe(true)
  })

  it('rejects when the current password is wrong', async () => {
    const { repository, install } = await setupOwner()
    const service = createUserService({ repository })
    const ownerRecord = (await repository.findUserById(install.organization.id, install.owner.id))!

    await expect(service.changeOwnPassword(ownerRecord, {
      currentPassword: 'wrong password',
      newPassword: 'a much better passphrase!',
    })).rejects.toThrow(/credentials/i)

    const fresh = (await repository.findUserById(install.organization.id, install.owner.id))!
    expect(fresh.mustChangePassword).toBe(true)
    expect(await verifyPassword('correct horse battery staple', fresh.passwordHash)).toBe(true)
  })

  it('rejects when the new password is too short', async () => {
    const { repository, install } = await setupOwner()
    const service = createUserService({ repository })
    const ownerRecord = (await repository.findUserById(install.organization.id, install.owner.id))!

    await expect(service.changeOwnPassword(ownerRecord, {
      currentPassword: 'correct horse battery staple',
      newPassword: 'short',
    })).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/enterprise/userServiceChangeOwnPassword.test.ts`
Expected: FAIL — `service.changeOwnPassword is not a function`.

- [ ] **Step 3: Extend the `UserService` interface**

In `apps/api/src/modules/users/userService.ts`, add to the `UserService` interface:

```ts
changeOwnPassword: (
  user: EnterpriseUserRecord,
  input: ChangeOwnPasswordRequest,
) => Promise<EnterpriseUser>
```

Add `ChangeOwnPasswordRequest` and `changeOwnPasswordRequestSchema` to the existing contracts import at the top of the file:

```ts
import type { ChangeOwnPasswordRequest, CreateUserRequest, EnterpriseUser, ResetPasswordRequest, UpdateUserRequest } from '@muon/enterprise-contracts'
import type { EnterpriseRepository, EnterpriseUserRecord } from '../../repository'
import { changeOwnPasswordRequestSchema, createUserRequestSchema, resetPasswordRequestSchema, updateUserRequestSchema } from '@muon/enterprise-contracts'
import { hashPassword, verifyPassword } from '../../security/password'
import { assertAdminRole } from './rbac'
```

(Note `verifyPassword` is added next to `hashPassword`.)

- [ ] **Step 4: Implement `changeOwnPassword`**

Inside `createUserService`'s returned object, add the method (place it alphabetically, near `createUser`):

```ts
async changeOwnPassword(user, input) {
  const request = changeOwnPasswordRequestSchema.parse(input)
  if (!await verifyPassword(request.currentPassword, user.passwordHash))
    throw new Error('Invalid credentials')

  const updated = await repository.resetUserPassword(user.organizationId, user.id, {
    passwordHash: await hashPassword(request.newPassword),
    mustChangePassword: false,
  })

  await repository.appendAuditLog({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: 'user.password_changed',
    targetType: 'user',
    targetId: user.id,
  })

  return repository.getPublicUser(updated)
},
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/enterprise/userServiceChangeOwnPassword.test.ts`
Expected: PASS (3 tests).

Run: `pnpm test:enterprise`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/users/userService.ts tests/unit/enterprise/userServiceChangeOwnPassword.test.ts
git commit -m "feat(api): support user self-change password"
```

---

## Task 6: `errorResponse` maps `MustChangePasswordError` → 403

So route handlers can throw the error and have it become a clean 403 with a machine-readable code.

**Files:**
- Modify: `apps/api/src/routes.ts`

- [ ] **Step 1: Update import**

In `apps/api/src/routes.ts`, the existing import is:

```ts
import { AdminAuthenticationError, createAdminSessionService } from './modules/auth/adminSessionService'
```

Replace with:

```ts
import { AdminAuthenticationError, createAdminSessionService, MustChangePasswordError } from './modules/auth/adminSessionService'
```

- [ ] **Step 2: Extend `errorResponse`**

In `apps/api/src/routes.ts`, the current `errorResponse` is:

```ts
function errorResponse(error: unknown): Response {
  if (error instanceof AdminAuthenticationError)
    return jsonResponse({ error: error.message }, { status: 401 })

  const message = error instanceof Error ? error.message : 'Unexpected error'
  const status = /credentials|not found|invalid/i.test(message) ? 400 : 409
  return jsonResponse({ error: message }, { status })
}
```

Replace with:

```ts
function errorResponse(error: unknown): Response {
  if (error instanceof AdminAuthenticationError)
    return jsonResponse({ error: error.message }, { status: 401 })

  if (error instanceof MustChangePasswordError)
    return jsonResponse({ error: error.code }, { status: 403 })

  const message = error instanceof Error ? error.message : 'Unexpected error'
  const status = /credentials|not found|invalid/i.test(message) ? 400 : 409
  return jsonResponse({ error: message }, { status })
}
```

Note the 403 body is `error.code` (the literal string `must_change_password`), not the human message — the frontend switches on this code.

- [ ] **Step 3: Confirm existing tests still pass**

Run: `pnpm test:enterprise`
Expected: PASS (61 + however many new tests are now in the suite).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes.ts
git commit -m "feat(api): map MustChangePasswordError to HTTP 403"
```

---

## Task 7: `requireFullyAuthorizedAdmin` + switch existing routes

The big route-layer change. Wrap `requireAdmin` with the must-change gate, switch every admin route except `/api/admin/me` over to it, and add the regression tests.

**Files:**
- Modify: `apps/api/src/routes.ts`
- Test: `tests/unit/enterprise/apiRoutes.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `tests/unit/enterprise/apiRoutes.test.ts` (inside the existing `describe('enterprise api routes', ...)`):

```ts
async function installAndLogin(handler: ReturnType<typeof createEnterpriseHttpHandler>) {
  await handler.fetch(new Request('http://muon.test/api/install', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      organizationName: 'Acme',
      organizationSlug: 'acme',
      ownerUsername: 'owner',
      ownerEmail: 'owner@acme.test',
      ownerDisplayName: 'Owner',
      ownerPassword: 'correct horse battery staple',
    }),
  }))

  const login = await handler.fetch(new Request('http://muon.test/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
    }),
  }))
  return (await login.json() as { session: { accessToken: string } }).session.accessToken
}

it('returns 403 must_change_password when a must-change user calls a gated admin endpoint', async () => {
  const handler = createEnterpriseHttpHandler()
  const token = await installAndLogin(handler)
  // Owner is created with mustChangePassword=true (installService default).
  const response = await handler.fetch(new Request('http://muon.test/api/admin/organizations', {
    headers: { authorization: `Bearer ${token}` },
  }))
  expect(response.status).toBe(403)
  expect(await response.json()).toEqual({ error: 'must_change_password' })
})

it('lets a must-change user still hit /api/admin/me', async () => {
  const handler = createEnterpriseHttpHandler()
  const token = await installAndLogin(handler)
  const response = await handler.fetch(new Request('http://muon.test/api/admin/me', {
    headers: { authorization: `Bearer ${token}` },
  }))
  expect(response.status).toBe(200)
  const body = await response.json() as { user: { mustChangePassword: boolean } }
  expect(body.user.mustChangePassword).toBe(true)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/enterprise/apiRoutes.test.ts`
Expected: FAIL — currently the must-change owner can call `/api/admin/organizations` and gets 200, not 403.

- [ ] **Step 3: Add `requireFullyAuthorizedAdmin`**

In `apps/api/src/routes.ts`, inside `createEnterpriseHttpHandler` (place this just below the existing `requireAdmin` function, which is around line 166):

```ts
async function requireFullyAuthorizedAdmin(request: Request): Promise<EnterpriseUserRecord> {
  const user = await requireAdmin(request)
  if (user.mustChangePassword)
    throw new MustChangePasswordError()
  return user
}
```

- [ ] **Step 4: Switch existing routes**

In `apps/api/src/routes.ts`, find each of these handlers and replace `requireAdmin` with `requireFullyAuthorizedAdmin`:

- The handler for `/api/admin/organizations` (currently around line 216) — keep `requireAdmin` for `/api/admin/me` (around line 211); switch the next block (`if (url.pathname === '/api/admin/organizations')`).
- The handler for `/api/admin/users` (around line 230).
- The handler for `adminUserRoute` (single-user PATCH and password reset, around line 246).
- The handler for `/api/admin/audit-logs` (around line 262).

The 5 lines you change look like:

```ts
const actor = await requireFullyAuthorizedAdmin(request)
```

Leave the `/api/admin/me` handler (line 211) on `requireAdmin`. That's the only existing admin route that stays unchanged.

Do a sanity grep to confirm:

```bash
grep -n "requireAdmin\|requireFullyAuthorizedAdmin" apps/api/src/routes.ts
```

After your edits you should see:
- 2 declarations (`requireAdmin` and `requireFullyAuthorizedAdmin`)
- 1 call site for `requireAdmin` (in `/api/admin/me` handler)
- 4 call sites for `requireFullyAuthorizedAdmin`

(After Tasks 8 and 9 add logout + password endpoints, the `requireAdmin` count will rise to 3.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/enterprise/apiRoutes.test.ts`
Expected: PASS — 7 existing + 2 new = 9 tests.

Run: `pnpm test:enterprise`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes.ts tests/unit/enterprise/apiRoutes.test.ts
git commit -m "feat(api): gate non-me admin routes on must-change-password"
```

---

## Task 8: `POST /api/admin/logout`

Server-side logout. `requireAdmin` (not the fully-authorized variant) so must-change users can also escape.

**Files:**
- Modify: `apps/api/src/routes.ts`
- Test: `tests/unit/enterprise/apiRoutes.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `tests/unit/enterprise/apiRoutes.test.ts`:

```ts
it('logs out an admin session, then rejects further requests with that token', async () => {
  const handler = createEnterpriseHttpHandler()
  const token = await installAndLogin(handler)

  const logout = await handler.fetch(new Request('http://muon.test/api/admin/logout', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  }))
  expect(logout.status).toBe(200)
  expect(await logout.json()).toEqual({ ok: true })

  const me = await handler.fetch(new Request('http://muon.test/api/admin/me', {
    headers: { authorization: `Bearer ${token}` },
  }))
  expect(me.status).toBe(401)
})

it('allows a must-change user to log out', async () => {
  const handler = createEnterpriseHttpHandler()
  const token = await installAndLogin(handler)
  // Owner still has mustChangePassword=true.
  const logout = await handler.fetch(new Request('http://muon.test/api/admin/logout', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  }))
  expect(logout.status).toBe(200)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/enterprise/apiRoutes.test.ts`
Expected: FAIL — `/api/admin/logout` returns 404 (route not implemented).

- [ ] **Step 3: Add the route handler**

In `apps/api/src/routes.ts`, inside the big `fetch(request)` if/else chain, between the `/api/admin/me` handler and the `/api/admin/organizations` handler, insert:

```ts
if (url.pathname === '/api/admin/logout') {
  if (request.method !== 'POST')
    return methodNotAllowed()
  const user = await requireAdmin(request)
  const token = bearerToken(request) ?? ''
  await adminSessionService.revoke(token)
  await repository.appendAuditLog({
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: 'admin.logout',
    targetType: 'user',
    targetId: user.id,
  })
  return withCors(jsonResponse({ ok: true }), request)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/enterprise/apiRoutes.test.ts`
Expected: PASS (9 + 2 = 11 tests).

Run: `pnpm test:enterprise`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes.ts tests/unit/enterprise/apiRoutes.test.ts
git commit -m "feat(api): implement POST /api/admin/logout"
```

---

## Task 9: `POST /api/admin/me/password`

Self-change-password endpoint. Calls `userService.changeOwnPassword` then `adminSessionService.revokeOthersForUser`.

**Files:**
- Modify: `apps/api/src/routes.ts`
- Test: `tests/unit/enterprise/apiRoutes.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `tests/unit/enterprise/apiRoutes.test.ts`:

```ts
it('lets a must-change user change their own password, clears the flag, and unlocks gated endpoints', async () => {
  const handler = createEnterpriseHttpHandler()
  const token = await installAndLogin(handler)

  const change = await handler.fetch(new Request('http://muon.test/api/admin/me/password', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      currentPassword: 'correct horse battery staple',
      newPassword: 'a much better passphrase!',
    }),
  }))
  expect(change.status).toBe(200)
  const changeBody = await change.json() as { user: { mustChangePassword: boolean } }
  expect(changeBody.user.mustChangePassword).toBe(false)

  // Gated endpoint now reachable.
  const orgs = await handler.fetch(new Request('http://muon.test/api/admin/organizations', {
    headers: { authorization: `Bearer ${token}` },
  }))
  expect(orgs.status).toBe(200)
})

it('rejects the wrong current password with 400', async () => {
  const handler = createEnterpriseHttpHandler()
  const token = await installAndLogin(handler)

  const response = await handler.fetch(new Request('http://muon.test/api/admin/me/password', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      currentPassword: 'totally wrong',
      newPassword: 'a much better passphrase!',
    }),
  }))
  expect(response.status).toBe(400)
})

it('revokes the user\'s other admin sessions on successful password change', async () => {
  const repository = createInMemoryEnterpriseRepository()
  const handler = createEnterpriseHttpHandler({ repository })
  const tokenA = await installAndLogin(handler)

  // Login again to create a second session for the same user.
  const login = await handler.fetch(new Request('http://muon.test/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
    }),
  }))
  const tokenB = (await login.json() as { session: { accessToken: string } }).session.accessToken

  // Change password using tokenA.
  await handler.fetch(new Request('http://muon.test/api/admin/me/password', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${tokenA}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      currentPassword: 'correct horse battery staple',
      newPassword: 'a much better passphrase!',
    }),
  }))

  // tokenA still valid.
  const meA = await handler.fetch(new Request('http://muon.test/api/admin/me', {
    headers: { authorization: `Bearer ${tokenA}` },
  }))
  expect(meA.status).toBe(200)

  // tokenB now invalid.
  const meB = await handler.fetch(new Request('http://muon.test/api/admin/me', {
    headers: { authorization: `Bearer ${tokenB}` },
  }))
  expect(meB.status).toBe(401)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/enterprise/apiRoutes.test.ts`
Expected: FAIL — `/api/admin/me/password` returns 404.

- [ ] **Step 3: Wire `userService` into `createEnterpriseHttpHandler`**

`createEnterpriseHttpHandler` already creates `userService` (it's used by the existing user routes). Confirm by reading the file — if `const userService = createUserService(...)` is already present near the top of the handler, skip this step.

- [ ] **Step 4: Add the route handler**

In `apps/api/src/routes.ts`, inside the `fetch(request)` chain, just after the `/api/admin/logout` block from Task 8 (and before the `/api/admin/organizations` block), insert:

```ts
if (url.pathname === '/api/admin/me/password') {
  if (request.method !== 'POST')
    return methodNotAllowed()
  const user = await requireAdmin(request)
  const updated = await userService.changeOwnPassword(user, await readRequestBody(request) as never)
  const token = bearerToken(request) ?? ''
  await adminSessionService.revokeOthersForUser(token)
  return withCors(jsonResponse({ user: updated }), request)
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/enterprise/apiRoutes.test.ts`
Expected: PASS (11 + 3 = 14 tests).

Run: `pnpm test:enterprise`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes.ts tests/unit/enterprise/apiRoutes.test.ts
git commit -m "feat(api): implement POST /api/admin/me/password"
```

---

## Task 10: OAuth desktop refuses must-change-password users

Adds the only `MustChangePasswordError` throw outside the route layer.

**Files:**
- Modify: `apps/api/src/modules/oauth/oauthService.ts`
- Test: `tests/unit/enterprise/oauthDesktopFlow.test.ts` (extend)

- [ ] **Step 1: Append failing test**

Append to `tests/unit/enterprise/oauthDesktopFlow.test.ts`:

```ts
it('refuses OAuth login when the user must change their password', async () => {
  const repository = createInMemoryEnterpriseRepository()
  await createInstallService({ repository }).install({
    organizationName: 'Acme',
    organizationSlug: 'acme',
    ownerUsername: 'owner',
    ownerEmail: 'owner@acme.test',
    ownerDisplayName: 'Owner',
    ownerPassword: 'correct horse battery staple',
  })
  const oauth = createOAuthService({
    repository,
    matrix: {
      async ensureUser() {
        return { matrixUserId: '@owner.acme:localhost', accessToken: 'mx', deviceId: 'D' }
      },
    },
    matrixServerUrl: 'http://localhost',
  })

  await expect(oauth.loginAndCreateCode({
    organizationSlug: 'acme',
    username: 'owner',
    password: 'correct horse battery staple',
    clientId: 'muon-desktop',
    redirectUri: 'muon://auth/callback',
    codeChallenge: 'a'.repeat(43),
    codeChallengeMethod: 'S256',
    state: 'state-value',
  })).rejects.toMatchObject({ name: 'MustChangePasswordError' })
})
```

The existing file should already have the relevant imports — check whether `createInMemoryEnterpriseRepository`, `createOAuthService`, `createInstallService` are imported. If any are missing, add them to the import block at the top of the file. (You will see other tests in the file using the same setup pattern.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/enterprise/oauthDesktopFlow.test.ts`
Expected: FAIL — login currently succeeds (returns a code).

- [ ] **Step 3: Add the gate**

In `apps/api/src/modules/oauth/oauthService.ts`, find the existing `loginAndCreateCode` function. After `findActiveUser(...)` returns (around line 80), add:

```ts
if (user.mustChangePassword)
  throw new MustChangePasswordError()
```

Also update the imports at the top of the file:

```ts
import { MustChangePasswordError } from '../auth/adminSessionService'
```

(Add this import line below the existing ones.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/enterprise/oauthDesktopFlow.test.ts`
Expected: PASS.

Run: `pnpm test:enterprise`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/oauth/oauthService.ts tests/unit/enterprise/oauthDesktopFlow.test.ts
git commit -m "feat(api): refuse OAuth desktop login for must-change-password users"
```

---

## Task 11: Admin frontend — `logoutAdmin` + `changeOwnPassword` API clients

Two new functions in `apps/admin/src/api.ts`. The component changes come next.

**Files:**
- Modify: `apps/admin/src/api.ts`

- [ ] **Step 1: Append the two functions**

At the top of `apps/admin/src/api.ts`, add `ChangeOwnPasswordRequest` to the existing contracts import:

```ts
import type {
  AdminLoginRequest,
  AuditLog,
  ChangeOwnPasswordRequest,
  CreateOrganizationRequest,
  CreateUserRequest,
  EnterpriseUser,
  InstallRequest,
  MuonSession,
  Organization,
  ResetPasswordRequest,
  UpdateUserRequest,
} from '@muon/enterprise-contracts'
```

At the end of the file, append:

```ts
export function logoutAdmin(token: string): Promise<{ ok: true }> {
  return request('/api/admin/logout', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  })
}

export function changeOwnPassword(token: string, input: ChangeOwnPasswordRequest): Promise<{ user: EnterpriseUser }> {
  return request('/api/admin/me/password', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  })
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @muon/admin build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/api.ts
git commit -m "feat(admin): add logoutAdmin + changeOwnPassword clients"
```

---

## Task 12: Admin frontend — bootstrap detects must-change-password

When `/api/admin/me` reports `mustChangePassword=true`, set a state ref and skip the dashboard load. The actual overlay UI lands in Task 13; this task only adds the state plumbing and updates the mocks/tests so the failure is observable.

**Files:**
- Modify: `apps/admin/src/AdminApp.vue`
- Test: `tests/components/AdminApp.test.ts`

- [ ] **Step 1: Add `getAdminMe` mock override and failing test**

In `tests/components/AdminApp.test.ts`, the existing `vi.mock` block has `getAdminMe` returning a user with `mustChangePassword: false`. We need to override per-test. Use a new test that sets `mockResolvedValueOnce` on `getAdminMe` *before* mounting.

Append inside `describe('adminApp', ...)`:

```ts
it('does not call refreshDashboard when the bootstrap user has mustChangePassword=true', async () => {
  window.localStorage.setItem('muon_admin_token', 'must-change-token')
  ;(getAdminMe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    user: {
      id: 'user-must-change',
      organizationId: 'org-1',
      username: 'novice',
      email: 'novice@muon.local',
      displayName: 'Novice',
      status: 'active',
      mustChangePassword: true,
      roles: ['member'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  })

  mount(AdminApp, {
    props: { initialInstalled: true },
    global: {
      plugins: [createAdminRouter(createMemoryHistory())],
    },
  })
  await flushPromises()

  expect(listOrganizations).not.toHaveBeenCalled()
  expect(listUsers).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run tests to verify it fails**

Run: `pnpm vitest run tests/components/AdminApp.test.ts`
Expected: FAIL — `listOrganizations` IS called because the current `bootstrap()` always runs `refreshDashboard()` after `getAdminMe`.

- [ ] **Step 3: Update `AdminApp.vue` bootstrap**

In `apps/admin/src/AdminApp.vue`, near the other `ref(...)` declarations at the top of `<script setup>`, add:

```ts
const mustChangePassword = ref(false)
```

Replace the existing `bootstrap()` function:

```ts
async function bootstrap() {
  const token = adminToken.value
  if (!token)
    return
  try {
    await getAdminMe(token)
    await refreshDashboard()
  }
  catch (err) {
    if (isAuthenticationError(err))
      clearAdminToken()
    else
      userError.value = err instanceof Error ? err.message : '加载后台数据失败'
  }
}
```

with:

```ts
async function bootstrap() {
  const token = adminToken.value
  if (!token)
    return
  try {
    const { user } = await getAdminMe(token)
    if (user.mustChangePassword) {
      mustChangePassword.value = true
      return
    }
    await refreshDashboard()
  }
  catch (err) {
    if (isAuthenticationError(err))
      clearAdminToken()
    else
      userError.value = err instanceof Error ? err.message : '加载后台数据失败'
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/components/AdminApp.test.ts`
Expected: PASS (17 + 1 = 18 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/AdminApp.vue tests/components/AdminApp.test.ts
git commit -m "feat(admin): bootstrap detects must-change-password from /api/admin/me"
```

---

## Task 13: Admin frontend — forced-change-password overlay

Add the overlay UI that takes over when `mustChangePassword.value === true`, with a form that calls `changeOwnPassword` and an escape "退出登录" link.

**Files:**
- Modify: `apps/admin/src/AdminApp.vue`
- Test: `tests/components/AdminApp.test.ts`

- [ ] **Step 1: Add `changeOwnPassword` and `logoutAdmin` to the test mock**

In `tests/components/AdminApp.test.ts`, extend the `vi.mock('../../apps/admin/src/api', () => ({...}))` block by adding (alphabetically — `changeOwnPassword` goes before `createAdminUser`, `logoutAdmin` goes before `resetAdminUserPassword`):

```ts
changeOwnPassword: vi.fn(async () => ({
  user: {
    id: 'user-owner',
    organizationId: 'org-1',
    username: 'owner',
    email: 'owner@muon.local',
    displayName: 'Owner',
    status: 'active',
    mustChangePassword: false,
    roles: ['owner'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
})),
```

```ts
logoutAdmin: vi.fn(async () => ({ ok: true })),
```

Update the destructured imports at the top of the test file to include both:

```ts
import {
  changeOwnPassword,
  createAdminUser,
  createOrganization,
  getAdminMe,
  listAuditLogs,
  listOrganizations,
  listUsers,
  loginAdmin,
  logoutAdmin,
  resetAdminUserPassword,
  updateAdminUser,
} from '../../apps/admin/src/api'
```

- [ ] **Step 2: Append failing tests**

Inside `describe('adminApp', ...)`, append:

```ts
it('shows the forced-change-password overlay when bootstrap sees mustChangePassword=true', async () => {
  window.localStorage.setItem('muon_admin_token', 'must-change-token')
  ;(getAdminMe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    user: {
      id: 'user-must-change',
      organizationId: 'org-1',
      username: 'novice',
      email: 'novice@muon.local',
      displayName: 'Novice',
      status: 'active',
      mustChangePassword: true,
      roles: ['member'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  })

  const wrapper = mount(AdminApp, {
    props: { initialInstalled: true },
    global: {
      plugins: [createAdminRouter(createMemoryHistory())],
    },
  })
  await flushPromises()

  expect(wrapper.find('[data-testid="force-change-password"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="organizations-panel"]').exists()).toBe(false)
})

it('submitting the overlay form changes the password and loads the dashboard', async () => {
  window.localStorage.setItem('muon_admin_token', 'must-change-token')
  ;(getAdminMe as ReturnType<typeof vi.fn>)
    .mockResolvedValueOnce({
      user: {
        id: 'user-must-change',
        organizationId: 'org-1',
        username: 'novice',
        email: 'novice@muon.local',
        displayName: 'Novice',
        status: 'active',
        mustChangePassword: true,
        roles: ['member'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })
    .mockResolvedValueOnce({
      user: {
        id: 'user-must-change',
        organizationId: 'org-1',
        username: 'novice',
        email: 'novice@muon.local',
        displayName: 'Novice',
        status: 'active',
        mustChangePassword: false,
        roles: ['member'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })

  const wrapper = mount(AdminApp, {
    props: { initialInstalled: true },
    global: {
      plugins: [createAdminRouter(createMemoryHistory())],
    },
  })
  await flushPromises()

  await wrapper.find('[data-testid="force-change-password-current"]').setValue('correct horse battery staple')
  await wrapper.find('[data-testid="force-change-password-new"]').setValue('a much better passphrase!')
  await wrapper.find('[data-testid="force-change-password"]').trigger('submit.prevent')
  await flushPromises()

  expect(changeOwnPassword).toHaveBeenCalledWith('must-change-token', {
    currentPassword: 'correct horse battery staple',
    newPassword: 'a much better passphrase!',
  })
  expect(wrapper.find('[data-testid="force-change-password"]').exists()).toBe(false)
  expect(listOrganizations).toHaveBeenCalled()
})

it('shows an inline error when changeOwnPassword fails', async () => {
  window.localStorage.setItem('muon_admin_token', 'must-change-token')
  ;(getAdminMe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    user: {
      id: 'user-must-change',
      organizationId: 'org-1',
      username: 'novice',
      email: 'novice@muon.local',
      displayName: 'Novice',
      status: 'active',
      mustChangePassword: true,
      roles: ['member'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  })
  ;(changeOwnPassword as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Invalid credentials'))

  const wrapper = mount(AdminApp, {
    props: { initialInstalled: true },
    global: {
      plugins: [createAdminRouter(createMemoryHistory())],
    },
  })
  await flushPromises()

  await wrapper.find('[data-testid="force-change-password-current"]').setValue('wrong')
  await wrapper.find('[data-testid="force-change-password-new"]').setValue('a much better passphrase!')
  await wrapper.find('[data-testid="force-change-password"]').trigger('submit.prevent')
  await flushPromises()

  expect(wrapper.find('[data-testid="force-change-password-error"]').text()).toMatch(/credentials/i)
  expect(wrapper.find('[data-testid="force-change-password"]').exists()).toBe(true)
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run tests/components/AdminApp.test.ts`
Expected: FAIL — `[data-testid="force-change-password"]` doesn't exist anywhere.

- [ ] **Step 4: Implement the overlay**

In `apps/admin/src/AdminApp.vue`:

**4a.** Update the imports at the top of `<script setup>`:

```ts
import { createAdminUser, createOrganization, changeOwnPassword, getAdminMe, installMuon, listAuditLogs, listOrganizations, listUsers, loginAdmin, logoutAdmin, resetAdminUserPassword, updateAdminUser } from './api'
```

(Order: alphabetical-ish — keep the existing pattern, just add `changeOwnPassword` and `logoutAdmin`.)

**4b.** Below the `mustChangePassword` ref added in Task 12, add form state:

```ts
const changePasswordForm = reactive({ currentPassword: '', newPassword: '' })
const changePasswordSubmitting = ref(false)
const changePasswordError = ref('')
```

Add a submit handler near `submitLogin` / `submitInstall`:

```ts
async function submitForceChangePassword() {
  if (!adminToken.value || changePasswordSubmitting.value)
    return

  changePasswordSubmitting.value = true
  changePasswordError.value = ''
  try {
    await changeOwnPassword(adminToken.value, {
      currentPassword: changePasswordForm.currentPassword,
      newPassword: changePasswordForm.newPassword,
    })
    changePasswordForm.currentPassword = ''
    changePasswordForm.newPassword = ''
    mustChangePassword.value = false
    await refreshDashboard()
  }
  catch (err) {
    changePasswordError.value = err instanceof Error ? err.message : '修改密码失败'
  }
  finally {
    changePasswordSubmitting.value = false
  }
}
```

**4c.** In the `<template>`, insert a top-level overlay block. Place it inside the `<main class="admin-shell">` but BEFORE the existing `<section v-if="!installed" ...>` / `<section v-else-if="!loggedIn" ...>` / `<section v-else ...>` chain. The overlay needs to render OVER everything when active:

```html
<section
  v-if="mustChangePassword"
  class="force-change-password-overlay"
  data-testid="force-change-password-overlay"
>
  <form
    class="force-change-password-form"
    data-testid="force-change-password"
    @submit.prevent="submitForceChangePassword"
  >
    <div class="page-heading">
      <p>首次登录</p>
      <h1>请修改初始密码</h1>
    </div>
    <Label class="grid gap-1.5">
      当前密码
      <Input
        v-model="changePasswordForm.currentPassword"
        data-testid="force-change-password-current"
        type="password"
        autocomplete="current-password"
      />
    </Label>
    <Label class="grid gap-1.5">
      新密码,至少 12 位
      <Input
        v-model="changePasswordForm.newPassword"
        data-testid="force-change-password-new"
        type="password"
        autocomplete="new-password"
      />
    </Label>
    <p
      v-if="changePasswordError"
      class="error"
      data-testid="force-change-password-error"
    >
      {{ changePasswordError }}
    </p>
    <Button class="w-fit" type="submit" :disabled="changePasswordSubmitting">
      {{ changePasswordSubmitting ? '正在保存' : '保存新密码' }}
    </Button>
    <button
      type="button"
      class="force-change-password-escape"
      data-testid="force-change-password-escape"
      @click="logout"
    >
      退出登录
    </button>
  </form>
</section>
```

The `logout` function is added in Task 14 — for now, also add a stub at the same time inside `<script setup>` so the template compiles:

```ts
async function logout() {
  clearAdminToken()
}
```

(Task 14 fleshes this out to call `logoutAdmin` first.)

**4d.** Add scoped CSS to the existing `<style scoped>` block:

```css
.force-change-password-overlay {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(15, 23, 42, 0.55);
  z-index: 50;
  padding: 24px;
}

.force-change-password-form {
  width: min(420px, calc(100vw - 48px));
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  display: grid;
  gap: 14px;
  box-shadow: 0 18px 42px rgba(16, 24, 40, 0.18);
}

.force-change-password-escape {
  align-self: flex-start;
  border: 0;
  background: transparent;
  color: #2563eb;
  font: inherit;
  padding: 0;
  cursor: pointer;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/components/AdminApp.test.ts`
Expected: PASS (18 + 3 = 21 tests).

- [ ] **Step 6: Run full enterprise suite**

Run: `pnpm test:enterprise`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/AdminApp.vue tests/components/AdminApp.test.ts
git commit -m "feat(admin): forced change-password overlay for must-change users"
```

---

## Task 14: Admin frontend — wire logout to call `logoutAdmin`

The existing "退出登录" button currently only clears localStorage. Wire it to call `/api/admin/logout` first (best-effort), then clear.

**Files:**
- Modify: `apps/admin/src/AdminApp.vue`
- Test: `tests/components/AdminApp.test.ts`

- [ ] **Step 1: Append failing test**

Inside `describe('adminApp', ...)`, append:

```ts
it('calls logoutAdmin before clearing the stored token when the user logs out', async () => {
  window.localStorage.setItem('muon_admin_token', 'session-token')
  const wrapper = mount(AdminApp, {
    props: { initialInstalled: true },
    global: {
      plugins: [createAdminRouter(createMemoryHistory())],
    },
  })
  await flushPromises()

  await wrapper.find('[data-testid="logout-admin"]').trigger('click')
  await flushPromises()

  expect(logoutAdmin).toHaveBeenCalledWith('session-token')
  expect(window.localStorage.getItem('muon_admin_token')).toBe(null)
})

it('clears the stored token even when logoutAdmin rejects', async () => {
  window.localStorage.setItem('muon_admin_token', 'session-token')
  ;(logoutAdmin as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network down'))

  const wrapper = mount(AdminApp, {
    props: { initialInstalled: true },
    global: {
      plugins: [createAdminRouter(createMemoryHistory())],
    },
  })
  await flushPromises()

  await wrapper.find('[data-testid="logout-admin"]').trigger('click')
  await flushPromises()

  expect(window.localStorage.getItem('muon_admin_token')).toBe(null)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/components/AdminApp.test.ts`
Expected: FAIL — the existing logout-admin button is wired to `clearAdminToken` directly; `logoutAdmin` is not called.

- [ ] **Step 3: Replace the `logout` function**

In `apps/admin/src/AdminApp.vue`, replace the Task 13 stub:

```ts
async function logout() {
  clearAdminToken()
}
```

with:

```ts
async function logout() {
  const token = adminToken.value
  if (token) {
    try {
      await logoutAdmin(token)
    }
    catch {
      // Best-effort: server may already have invalidated the token.
    }
  }
  clearAdminToken()
}
```

- [ ] **Step 4: Update the logout button binding**

Find this template element (around the existing dashboard header):

```html
<Button data-testid="logout-admin" type="button" variant="secondary" @click="clearAdminToken">
  退出登录
</Button>
```

Change `@click="clearAdminToken"` to `@click="logout"`:

```html
<Button data-testid="logout-admin" type="button" variant="secondary" @click="logout">
  退出登录
</Button>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/components/AdminApp.test.ts`
Expected: PASS (21 + 2 = 23 tests).

- [ ] **Step 6: Run full enterprise suite + type-check + lint**

Run: `pnpm test:enterprise`
Expected: PASS.

Run: `pnpm type-check`
Expected: exit 0.

Run: `pnpm lint`
Expected: exit 0 (or only pre-existing lint issues unrelated to this branch).

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/AdminApp.vue tests/components/AdminApp.test.ts
git commit -m "feat(admin): server-side logout via /api/admin/logout"
```

---

## Final verification

- [ ] **Step 1: Run the entire enterprise test suite**

Run: `pnpm test:enterprise`
Expected: ALL PASS.

- [ ] **Step 2: Top-level type-check**

Run: `pnpm type-check`
Expected: exit 0.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: exit 0.

- [ ] **Step 4: Audit `requireAdmin` vs `requireFullyAuthorizedAdmin` distribution**

Run:

```bash
grep -n "requireAdmin\|requireFullyAuthorizedAdmin" apps/api/src/routes.ts
```

You should see:
- 2 declarations
- 3 call sites for `requireAdmin` (`/api/admin/me`, `/api/admin/logout`, `/api/admin/me/password`)
- 4 call sites for `requireFullyAuthorizedAdmin` (`/api/admin/organizations`, `/api/admin/users`, single-user routes, `/api/admin/audit-logs`)

If any admin endpoint added in the future uses `requireAdmin` by mistake instead of `requireFullyAuthorizedAdmin`, this grep is the audit that catches it.

- [ ] **Step 5: Manual smoke test (optional)**

```bash
# Terminal 1
pnpm services:up
pnpm dev:api

# Terminal 2
pnpm dev:admin
```

In the admin UI:
1. Install. Log in. Confirm forced-change-password overlay appears.
2. Try wrong current password — inline error shows.
3. Submit correct currentPassword + new password — overlay closes, dashboard loads.
4. Click 退出登录 — confirm you land on login screen.
5. Log in again — should go straight to dashboard (no overlay this time).
