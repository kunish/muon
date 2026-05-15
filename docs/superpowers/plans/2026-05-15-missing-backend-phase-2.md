# Missing Backend — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship desktop OAuth session lifecycle — `POST /api/oauth/refresh` with strict refresh-token rotation, admin `GET/DELETE /api/admin/users/:id/sessions` for device session management, migration of `device_sessions.access_token` plaintext → hashed, and desktop auto-refresh on startup when within 24h of expiry.

**Architecture:** Refresh re-uses the existing `matrix_accounts` row (matrix-side re-issuance is deferred — conduit adapter is currently create-only). Each successful refresh creates a new `device_sessions` row and revokes the old one. The admin device-session API surfaces non-revoked, non-expired sessions and lets admins revoke any single one. Desktop calls refresh once on startup when near expiry; mid-session 401-retry is out of scope.

**Tech Stack:** TypeScript, Node `node:http`, `pg`, zod, Vitest + `@vue/test-utils`, Vue 3, Postgres 16. All tests run via repo-root `vitest.config.ts`.

**Reference spec:** `docs/superpowers/specs/2026-05-15-missing-backend-phase-2-design.md`

---

## File Structure

**Create:**
- `apps/api/src/db/migrations/0003_device_sessions_hash_access_token.sql` — schema reset for hashed access tokens
- `tests/unit/enterprise/oauthRefresh.test.ts` — refresh service tests
- `tests/unit/enterprise/deviceSessions.test.ts` — new repository methods + admin route flow

**Modify:**
- `packages/enterprise-contracts/src/schemas.ts` — add `oauthRefreshRequestSchema`, `deviceSessionSchema`
- `apps/api/src/repository.ts` — 3 new device-session methods + field rename
- `apps/api/src/db/postgresRepository.ts` — Postgres impl of 3 new methods + column rename in row mapper / SQL
- `apps/api/src/modules/oauth/oauthService.ts` — hash access tokens, add `refresh` method, rename audit action
- `apps/api/src/routes.ts` — three new endpoints + path-match helper for `/api/admin/users/:id/sessions[/:sid]`
- `apps/admin/src/api.ts` — `listUserDeviceSessions`, `revokeUserDeviceSession`
- `apps/admin/src/AdminApp.vue` — lazy-loaded device-session panel under each user
- `src/matrix/auth.ts` — `refreshEnterpriseSession`, `maybeRefreshOnStartup`, hooked into `restoreSession`
- `tests/components/AdminApp.test.ts` — panel and revoke tests
- `tests/unit/auth.test.ts` (or new) — desktop refresh helper tests (if a test for `auth.ts` exists; otherwise create one)

---

## Task 1: Migration `0003_device_sessions_hash_access_token.sql`

Pure data file. Schema reset because no production users.

**Files:**
- Create: `apps/api/src/db/migrations/0003_device_sessions_hash_access_token.sql`

- [ ] **Step 1: Create the migration**

Write `apps/api/src/db/migrations/0003_device_sessions_hash_access_token.sql`:

```sql
DELETE FROM device_sessions;

ALTER TABLE device_sessions DROP COLUMN access_token;
ALTER TABLE device_sessions ADD COLUMN access_token_hash TEXT NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_sessions_access_hash
  ON device_sessions (access_token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_sessions_refresh_hash
  ON device_sessions (refresh_token_hash);
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/db/migrations/0003_device_sessions_hash_access_token.sql
git commit -m "feat(api): migrate device_sessions to hashed access tokens"
```

## Constraints

- No tests in this task — the migration is verified indirectly by Task 4's tests.
- Don't backfill `access_token_hash` from `access_token` — the spec says to DELETE existing rows.
- Migration runner (Phase 0) scans `migrations/*.sql` lexicographically, so this file is picked up automatically.

---

## Task 2: Contracts — `oauthRefreshRequestSchema` + `deviceSessionSchema`

Two new zod schemas.

**Files:**
- Modify: `packages/enterprise-contracts/src/schemas.ts`

- [ ] **Step 1: Append the schemas**

At the END of `packages/enterprise-contracts/src/schemas.ts`, append:

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

- [ ] **Step 2: Build the contracts package**

Run: `pnpm --filter @muon/enterprise-contracts build`
Expected: exit 0.

- [ ] **Step 3: Run full enterprise tests to confirm no regression**

Run: `pnpm test:enterprise`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/enterprise-contracts/src/schemas.ts
git commit -m "feat(contracts): add oauthRefreshRequestSchema + deviceSessionSchema"
```

## Constraints

- `index.ts` re-exports everything from `schemas.ts` — no additional export wiring.
- Refresh response shape REUSES the existing `oauthTokenResponseSchema` — don't create a separate `oauthRefreshResponseSchema`.

---

## Task 3: Repository — 3 new device-session methods (additive)

Add `findDeviceSessionByRefreshTokenHash`, `findActiveDeviceSessionsByUser`, `revokeDeviceSession` to the EnterpriseRepository interface and both implementations. The field rename comes in Task 4.

**Files:**
- Modify: `apps/api/src/repository.ts`
- Modify: `apps/api/src/db/postgresRepository.ts`
- Test: `tests/unit/enterprise/deviceSessions.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/enterprise/deviceSessions.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createInstallService } from '../../../apps/api/src/modules/install/installService'
import { createInMemoryEnterpriseRepository } from '../../../apps/api/src/repository'

async function setupInstalled() {
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

describe('device session repository methods', () => {
  it('findDeviceSessionByRefreshTokenHash returns the matching row', async () => {
    const { repository, install } = await setupInstalled()
    const created = await repository.createDeviceSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      deviceName: 'Muon Desktop',
      accessToken: 'plain-access-1', // pre-Task-4 field still named accessToken
      refreshTokenHash: 'refresh-hash-1',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })

    const found = await repository.findDeviceSessionByRefreshTokenHash('refresh-hash-1')
    expect(found?.id).toBe(created.id)

    const missing = await repository.findDeviceSessionByRefreshTokenHash('no-such-hash')
    expect(missing).toBeNull()
  })

  it('findActiveDeviceSessionsByUser returns only non-revoked, non-expired rows', async () => {
    const { repository, install } = await setupInstalled()

    const active = await repository.createDeviceSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      deviceName: 'Muon Desktop A',
      accessToken: 'a',
      refreshTokenHash: 'a-r',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })

    const expired = await repository.createDeviceSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      deviceName: 'Muon Desktop B',
      accessToken: 'b',
      refreshTokenHash: 'b-r',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    })

    const revoked = await repository.createDeviceSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      deviceName: 'Muon Desktop C',
      accessToken: 'c',
      refreshTokenHash: 'c-r',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })
    await repository.revokeDeviceSession(revoked.id)

    const list = await repository.findActiveDeviceSessionsByUser(install.organization.id, install.owner.id)
    expect(list.map(s => s.id)).toEqual([active.id])

    void expired
  })

  it('revokeDeviceSession sets revokedAt and is idempotent', async () => {
    const { repository, install } = await setupInstalled()
    const created = await repository.createDeviceSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      deviceName: 'Muon Desktop',
      accessToken: 'plain',
      refreshTokenHash: 'plain-r',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })

    await repository.revokeDeviceSession(created.id)
    const firstRevokedAt = (await repository.findDeviceSessionByRefreshTokenHash('plain-r'))?.revokedAt
    expect(firstRevokedAt).toBeTruthy()

    await new Promise(resolve => setTimeout(resolve, 5))
    await repository.revokeDeviceSession(created.id)
    await repository.revokeDeviceSession('unknown-id')

    const afterRevokedAt = (await repository.findDeviceSessionByRefreshTokenHash('plain-r'))?.revokedAt
    expect(afterRevokedAt).toBe(firstRevokedAt)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/enterprise/deviceSessions.test.ts`
Expected: FAIL — `findDeviceSessionByRefreshTokenHash is not a function`.

- [ ] **Step 3: Add interface entries**

In `apps/api/src/repository.ts`, inside the `EnterpriseRepository` interface, add (alphabetical placement near `revokeAdminSession` and `revokeAllAdminSessionsForUserExcept`):

```ts
findActiveDeviceSessionsByUser: (
  organizationId: string,
  userId: string,
) => Promise<DeviceSessionRecord[]>
findDeviceSessionByRefreshTokenHash: (refreshTokenHash: string) => Promise<DeviceSessionRecord | null>
revokeDeviceSession: (id: string) => Promise<void>
```

- [ ] **Step 4: Implement in-memory**

Inside `createInMemoryEnterpriseRepository`'s returned object, add:

```ts
async findActiveDeviceSessionsByUser(organizationId, userId) {
  const now = Date.now()
  return deviceSessions.filter(session =>
    session.organizationId === organizationId
    && session.userId === userId
    && session.revokedAt === null
    && Date.parse(session.expiresAt) > now,
  )
},

async findDeviceSessionByRefreshTokenHash(refreshTokenHash) {
  return deviceSessions.find(session => session.refreshTokenHash === refreshTokenHash) ?? null
},

async revokeDeviceSession(id) {
  const session = deviceSessions.find(item => item.id === id)
  if (session && !session.revokedAt)
    session.revokedAt = nowIso()
},
```

- [ ] **Step 5: Implement Postgres**

In `apps/api/src/db/postgresRepository.ts`, inside `createPostgresEnterpriseRepository`'s returned object, add:

```ts
async findActiveDeviceSessionsByUser(organizationId: string, userId: string) {
  const result = await pool.query(
    `SELECT * FROM device_sessions
      WHERE organization_id = $1
        AND user_id = $2
        AND revoked_at IS NULL
        AND expires_at > NOW()
      ORDER BY created_at DESC`,
    [organizationId, userId],
  )
  return result.rows.map(deviceSessionFromRow)
},

async findDeviceSessionByRefreshTokenHash(refreshTokenHash: string) {
  const result = await pool.query(
    'SELECT * FROM device_sessions WHERE refresh_token_hash = $1',
    [refreshTokenHash],
  )
  return result.rows[0] ? deviceSessionFromRow(result.rows[0]) : null
},

async revokeDeviceSession(id: string) {
  await pool.query(
    'UPDATE device_sessions SET revoked_at = COALESCE(revoked_at, $2) WHERE id = $1',
    [id, nowIso()],
  )
},
```

You also need a `deviceSessionFromRow` row mapper. Add it near the other row mappers (alphabetical):

```ts
function deviceSessionFromRow(row: Record<string, unknown>): DeviceSessionRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    userId: String(row.user_id),
    deviceName: String(row.device_name),
    accessToken: String(row.access_token), // pre-Task-4: still named accessToken in code; column is also access_token in DB at this point because Task 1's migration hasn't been *materialized* against the schema cache assumption in this task either way — the field rename comes in Task 4
    refreshTokenHash: String(row.refresh_token_hash),
    expiresAt: iso(row.expires_at as string | Date),
    revokedAt: row.revoked_at ? iso(row.revoked_at as string | Date) : null,
    createdAt: iso(row.created_at as string | Date),
  }
}
```

**Important pre-Task-4 note:** Migration 0003 (Task 1) drops the `access_token` column. If the Postgres tests don't run (and they don't — no Postgres in CI), this is fine. But you have a 1-task window where if anyone runs `pnpm dev:api` against a freshly-migrated database AND triggers `createDeviceSession` (via `/api/oauth/token`), it will fail because the SQL references `access_token`. Task 4 fixes this. Do NOT manually test this state.

If your TypeScript build fails because `DeviceSessionRecord.accessToken` is still expected, that's correct — Task 4 renames it. For this task, the field name remains `accessToken`.

- [ ] **Step 6: Run tests**

Run: `pnpm vitest run tests/unit/enterprise/deviceSessions.test.ts`
Expected: PASS (3 tests).

Run: `pnpm test:enterprise`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/repository.ts apps/api/src/db/postgresRepository.ts tests/unit/enterprise/deviceSessions.test.ts
git commit -m "feat(api): add device-session lookup, list-active, and revoke"
```

## Constraints

- DON'T rename `DeviceSessionRecord.accessToken` to `accessTokenHash` in this task — Task 4 does the atomic rename with the hash-storage change.
- The `deviceSessionFromRow` mapper still reads `row.access_token` column — Task 4 updates this.
- `findActiveDeviceSessionsByUser` filters BOTH `revoked_at IS NULL` AND `expires_at > NOW()` — both are required.

---

## Task 4: Rename `accessToken` → `accessTokenHash` + hash on exchange

Atomic rename: the repository field, the in-memory and Postgres implementations, AND `oauthService.exchangeCode` (which is the only writer) all switch in one commit. Existing tests should still pass because `muonSession.accessToken` (plaintext, returned to client) is unchanged.

**Files:**
- Modify: `apps/api/src/repository.ts`
- Modify: `apps/api/src/db/postgresRepository.ts`
- Modify: `apps/api/src/modules/oauth/oauthService.ts`
- Test: `tests/unit/enterprise/oauthDesktopFlow.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/enterprise/oauthDesktopFlow.test.ts`:

```ts
it('exchangeCode stores access_token as a hash, not plaintext', async () => {
  const { repository, oauth, ...rest } = await setupOauthHappyPath()
  // setupOauthHappyPath should already exist in the file from earlier; if not, use the inline setup pattern of the existing tests
  const result = await oauth.exchangeCode({
    code: rest.code,
    codeVerifier: rest.codeVerifier,
    redirectUri: 'muon://auth/callback',
    clientId: 'muon-desktop',
    deviceName: 'Muon Desktop',
  })

  const stored = repository.deviceSessions[0]
  expect(stored.accessTokenHash).not.toBe(result.muonSession.accessToken)
  // Verify the hash matches what we'd compute (depends on the helper exported below)
})
```

Look at the existing test file structure — adapt the test to match what's already there. Specifically, if there's no `setupOauthHappyPath` helper, write the test inline using the same pattern as `tests/unit/enterprise/oauthDesktopFlow.test.ts` already uses (it has full inline setups in some tests).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/enterprise/oauthDesktopFlow.test.ts`
Expected: FAIL — `stored.accessTokenHash` is undefined; the field is still `stored.accessToken` containing plaintext.

- [ ] **Step 3: Rename the field in repository.ts**

In `apps/api/src/repository.ts`:

**3a.** Find `DeviceSessionRecord`:

```ts
export interface DeviceSessionRecord {
  accessToken: string
  createdAt: string
  deviceName: string
  expiresAt: string
  id: string
  organizationId: string
  refreshTokenHash: string
  revokedAt: string | null
  userId: string
}
```

Replace `accessToken: string` with `accessTokenHash: string`:

```ts
export interface DeviceSessionRecord {
  accessTokenHash: string
  createdAt: string
  deviceName: string
  expiresAt: string
  id: string
  organizationId: string
  refreshTokenHash: string
  revokedAt: string | null
  userId: string
}
```

**3b.** Find `CreateDeviceSessionInput`:

```ts
export interface CreateDeviceSessionInput {
  accessToken: string
  deviceName: string
  expiresAt: string
  organizationId: string
  refreshTokenHash: string
  userId: string
}
```

Replace `accessToken: string` with `accessTokenHash: string`:

```ts
export interface CreateDeviceSessionInput {
  accessTokenHash: string
  deviceName: string
  expiresAt: string
  organizationId: string
  refreshTokenHash: string
  userId: string
}
```

**3c.** In `createInMemoryEnterpriseRepository`, find the `createDeviceSession` method:

```ts
async createDeviceSession(input) {
  const session: DeviceSessionRecord = {
    id: randomUUID(),
    organizationId: input.organizationId,
    userId: input.userId,
    deviceName: input.deviceName,
    accessToken: input.accessToken,
    refreshTokenHash: input.refreshTokenHash,
    expiresAt: input.expiresAt,
    revokedAt: null,
    createdAt: nowIso(),
  }
  deviceSessions.push(session)
  return session
},
```

Replace the `accessToken: input.accessToken` line with `accessTokenHash: input.accessTokenHash`:

```ts
async createDeviceSession(input) {
  const session: DeviceSessionRecord = {
    id: randomUUID(),
    organizationId: input.organizationId,
    userId: input.userId,
    deviceName: input.deviceName,
    accessTokenHash: input.accessTokenHash,
    refreshTokenHash: input.refreshTokenHash,
    expiresAt: input.expiresAt,
    revokedAt: null,
    createdAt: nowIso(),
  }
  deviceSessions.push(session)
  return session
},
```

- [ ] **Step 4: Update Postgres impl**

In `apps/api/src/db/postgresRepository.ts`:

**4a.** Update `deviceSessionFromRow` (added in Task 3):

```ts
function deviceSessionFromRow(row: Record<string, unknown>): DeviceSessionRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    userId: String(row.user_id),
    deviceName: String(row.device_name),
    accessTokenHash: String(row.access_token_hash),
    refreshTokenHash: String(row.refresh_token_hash),
    expiresAt: iso(row.expires_at as string | Date),
    revokedAt: row.revoked_at ? iso(row.revoked_at as string | Date) : null,
    createdAt: iso(row.created_at as string | Date),
  }
}
```

**4b.** Update the existing `createDeviceSession` SQL. Find the existing method:

```ts
async createDeviceSession(input: CreateDeviceSessionInput) {
  const result = await pool.query(
    `INSERT INTO device_sessions (id, organization_id, user_id, device_name, access_token, refresh_token_hash, expires_at, revoked_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8)
     RETURNING *`,
    [
      randomUUID(),
      input.organizationId,
      input.userId,
      input.deviceName,
      input.accessToken,
      input.refreshTokenHash,
      input.expiresAt,
      nowIso(),
    ],
  )
  return {
    id: String(result.rows[0].id),
    organizationId: String(result.rows[0].organization_id),
    userId: String(result.rows[0].user_id),
    deviceName: String(result.rows[0].device_name),
    accessToken: String(result.rows[0].access_token),
    refreshTokenHash: String(result.rows[0].refresh_token_hash),
    expiresAt: iso(result.rows[0].expires_at),
    revokedAt: result.rows[0].revoked_at ? iso(result.rows[0].revoked_at) : null,
    createdAt: iso(result.rows[0].created_at),
  }
},
```

Replace with (uses `access_token_hash` column and `deviceSessionFromRow`):

```ts
async createDeviceSession(input: CreateDeviceSessionInput) {
  const result = await pool.query(
    `INSERT INTO device_sessions (id, organization_id, user_id, device_name, access_token_hash, refresh_token_hash, expires_at, revoked_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8)
     RETURNING *`,
    [
      randomUUID(),
      input.organizationId,
      input.userId,
      input.deviceName,
      input.accessTokenHash,
      input.refreshTokenHash,
      input.expiresAt,
      nowIso(),
    ],
  )
  return deviceSessionFromRow(result.rows[0])
},
```

- [ ] **Step 5: Update `oauthService.exchangeCode` to hash the access token**

In `apps/api/src/modules/oauth/oauthService.ts`, find the existing `createDeviceSession` call in `exchangeCode`:

```ts
await repository.createDeviceSession({
  organizationId: authorizationCode.organizationId,
  userId: authorizationCode.userId,
  deviceName: request.deviceName,
  accessToken,
  refreshTokenHash: sha256(`refresh:${refreshToken}`),
  expiresAt,
})
```

Replace `accessToken` with `accessTokenHash: sha256(...)`:

```ts
await repository.createDeviceSession({
  organizationId: authorizationCode.organizationId,
  userId: authorizationCode.userId,
  deviceName: request.deviceName,
  accessTokenHash: sha256(`access:${accessToken}`),
  refreshTokenHash: sha256(`refresh:${refreshToken}`),
  expiresAt,
})
```

The plaintext `accessToken` variable still gets returned in `muonSession.accessToken` — that's unchanged.

- [ ] **Step 6: Update the failing test from Step 1 with the hash check**

Now that `sha256` is available, finalize the test assertion. The test will need access to `sha256` — either:

(a) Import the helper from oauthService (it's not exported today — would need to export)
(b) Recreate the hash logic in the test

Use (b) — recreate. Update the test:

```ts
it('exchangeCode stores access_token as a hash, not plaintext', async () => {
  // ... existing setup leading to result = await oauth.exchangeCode(...)

  const stored = repository.deviceSessions[0]
  expect(stored.accessTokenHash).not.toBe(result.muonSession.accessToken)

  const expectedHash = createHash('sha256')
    .update(`access:${result.muonSession.accessToken}`)
    .digest('base64url')
  expect(stored.accessTokenHash).toBe(expectedHash)
})
```

Add to the test file's imports at the top:

```ts
import { createHash } from 'node:crypto'
```

The `sha256` helper in oauthService.ts uses `digest('base64url')`. Verify by re-reading that file — Phase 0 Task 8 added `sha256` with `digest('hex')` to adminSessionService.ts, but oauthService.ts has its own `sha256` helper using `base64url`. Make sure your test computes the hash with the SAME encoding.

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/enterprise/oauthDesktopFlow.test.ts`
Expected: PASS.

Run: `pnpm --filter @muon/api build`
Expected: exit 0 (TypeScript checks both repository impls satisfy the renamed interface).

Run: `pnpm test:enterprise`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/repository.ts apps/api/src/db/postgresRepository.ts apps/api/src/modules/oauth/oauthService.ts tests/unit/enterprise/oauthDesktopFlow.test.ts
git commit -m "feat(api): hash device-session access tokens at rest"
```

## Constraints

- The plaintext `accessToken` variable in `exchangeCode` is STILL returned to the client. Don't change `return { muonSession: { accessToken, ... } }`.
- Both `sha256('access:' + accessToken)` and `sha256('refresh:' + refreshToken)` use the same `sha256` helper already in `oauthService.ts` (`base64url` encoding). Don't switch encodings.

---

## Task 5: `oauthService.refresh`

The new service method. Looks up by refresh-token hash, validates, re-uses `matrix_accounts`, mints new tokens, rotates the row.

**Files:**
- Modify: `apps/api/src/modules/oauth/oauthService.ts`
- Test: `tests/unit/enterprise/oauthRefresh.test.ts` (new)

- [ ] **Step 1: Write failing tests**

Create `tests/unit/enterprise/oauthRefresh.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createInstallService } from '../../../apps/api/src/modules/install/installService'
import { createOAuthService } from '../../../apps/api/src/modules/oauth/oauthService'
import { createInMemoryEnterpriseRepository } from '../../../apps/api/src/repository'

const PKCE_VERIFIER = 'a'.repeat(48)
const PKCE_CHALLENGE = 'a'.repeat(43)
// PKCE 'plain' so we don't need to actually sha256 in test setup

async function setupOauthSession() {
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
        return {
          matrixUserId: '@acme.owner:localhost',
          accessToken: 'mx-1',
          deviceId: 'D1',
        }
      },
    },
    matrixServerUrl: 'http://localhost:6167',
  })

  // Owner login + token exchange to get a fresh refresh token.
  const loginResult = await oauth.loginAndCreateCode({
    organizationSlug: 'acme',
    username: 'owner',
    password: 'correct horse battery staple',
    clientId: 'muon-desktop',
    redirectUri: 'muon://auth/callback',
    codeChallenge: PKCE_VERIFIER, // PKCE 'plain'
    codeChallengeMethod: 'plain',
    state: 'st',
  })
  const exchanged = await oauth.exchangeCode({
    code: loginResult.code,
    codeVerifier: PKCE_VERIFIER,
    redirectUri: 'muon://auth/callback',
    clientId: 'muon-desktop',
    deviceName: 'Muon Desktop',
  })

  return { repository, oauth, exchanged }
}

describe('oauthService.refresh', () => {
  it('issues a new access+refresh token pair and revokes the old session', async () => {
    const { repository, oauth, exchanged } = await setupOauthSession()
    const oldSession = repository.deviceSessions[0]

    const refreshed = await oauth.refresh({
      refreshToken: exchanged.muonSession.refreshToken,
      clientId: 'muon-desktop',
      deviceName: 'Muon Desktop',
    })

    // New tokens differ from old.
    expect(refreshed.muonSession.accessToken).not.toBe(exchanged.muonSession.accessToken)
    expect(refreshed.muonSession.refreshToken).not.toBe(exchanged.muonSession.refreshToken)

    // Matrix session is the same (re-attached, not re-issued).
    expect(refreshed.matrixSession.accessToken).toBe(exchanged.matrixSession.accessToken)
    expect(refreshed.matrixSession.deviceId).toBe(exchanged.matrixSession.deviceId)

    // Old device_sessions row was revoked.
    const oldRow = repository.deviceSessions.find(s => s.id === oldSession.id)
    expect(oldRow?.revokedAt).toBeTruthy()

    // New row exists, active.
    expect(repository.deviceSessions.length).toBe(2)
    const newRow = repository.deviceSessions.find(s => s.id !== oldSession.id)
    expect(newRow?.revokedAt).toBeNull()

    // Audit log records the refresh.
    expect(repository.auditLogs.some(e => e.action === 'oauth.token.refreshed')).toBe(true)
  })

  it('rejects re-use of the old refresh token after rotation', async () => {
    const { oauth, exchanged } = await setupOauthSession()
    await oauth.refresh({
      refreshToken: exchanged.muonSession.refreshToken,
      clientId: 'muon-desktop',
      deviceName: 'Muon Desktop',
    })

    await expect(oauth.refresh({
      refreshToken: exchanged.muonSession.refreshToken,
      clientId: 'muon-desktop',
      deviceName: 'Muon Desktop',
    })).rejects.toThrow(/invalid refresh token/i)
  })

  it('rejects an unknown refresh token', async () => {
    const { oauth } = await setupOauthSession()
    await expect(oauth.refresh({
      refreshToken: 'never-issued',
      clientId: 'muon-desktop',
      deviceName: 'Muon Desktop',
    })).rejects.toThrow(/invalid refresh token/i)
  })

  it('rejects when the session has expired', async () => {
    const { repository, oauth, exchanged } = await setupOauthSession()
    // Force expiry.
    repository.deviceSessions[0].expiresAt = new Date(Date.now() - 1000).toISOString()

    await expect(oauth.refresh({
      refreshToken: exchanged.muonSession.refreshToken,
      clientId: 'muon-desktop',
      deviceName: 'Muon Desktop',
    })).rejects.toThrow(/invalid refresh token/i)
  })

  it('rejects an invalid clientId', async () => {
    const { oauth, exchanged } = await setupOauthSession()
    await expect(oauth.refresh({
      refreshToken: exchanged.muonSession.refreshToken,
      clientId: 'wrong-client',
      deviceName: 'Muon Desktop',
    })).rejects.toThrow(/invalid oauth client/i)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/enterprise/oauthRefresh.test.ts`
Expected: FAIL — `oauth.refresh is not a function`.

- [ ] **Step 3: Update imports in `oauthService.ts`**

The existing imports at the top of `apps/api/src/modules/oauth/oauthService.ts` use:

```ts
import type {
  OAuthLoginRequest,
  OAuthLoginResponse,
  OAuthTokenRequest,
  OAuthTokenResponse,
} from '@muon/enterprise-contracts'
```

Add `OAuthRefreshRequest`:

```ts
import type {
  OAuthLoginRequest,
  OAuthLoginResponse,
  OAuthRefreshRequest,
  OAuthTokenRequest,
  OAuthTokenResponse,
} from '@muon/enterprise-contracts'
```

The existing import of zod schemas uses:

```ts
import { oauthLoginRequestSchema, oauthTokenRequestSchema } from '@muon/enterprise-contracts'
```

Add `oauthRefreshRequestSchema`:

```ts
import { oauthLoginRequestSchema, oauthRefreshRequestSchema, oauthTokenRequestSchema } from '@muon/enterprise-contracts'
```

- [ ] **Step 4: Extract a `assertDesktopClientId` helper**

The existing helper `assertDesktopClient(clientId, redirectUri)` (around line 41 of `oauthService.ts`) checks both id and redirect URI. Refresh has no redirectUri — so add a clientId-only variant. Replace the existing `assertDesktopClient` function with:

```ts
function assertDesktopClientId(clientId: string): void {
  if (clientId !== DESKTOP_CLIENT_ID)
    throw new Error('Invalid OAuth client')
}

function assertDesktopClient(clientId: string, redirectUri: string): void {
  assertDesktopClientId(clientId)
  if (redirectUri !== DESKTOP_REDIRECT_URI)
    throw new Error('Invalid OAuth client')
}
```

(`assertDesktopClient` is still used by `loginAndCreateCode` and `exchangeCode` — keep it; it now delegates to the id-only helper.)

- [ ] **Step 5: Extend the `OAuthService` interface**

```ts
export interface OAuthService {
  exchangeCode: (input: OAuthTokenRequest) => Promise<OAuthTokenResponse>
  loginAndCreateCode: (input: OAuthLoginRequest) => Promise<OAuthLoginResponse>
  refresh: (input: OAuthRefreshRequest) => Promise<OAuthTokenResponse>
}
```

- [ ] **Step 6: Implement `refresh`**

Inside `createOAuthService`'s returned object (after `exchangeCode`), add:

```ts
async refresh(input) {
  const request = oauthRefreshRequestSchema.parse(input)
  assertDesktopClientId(request.clientId)

  const session = await repository.findDeviceSessionByRefreshTokenHash(sha256(`refresh:${request.refreshToken}`))
  if (!session || session.revokedAt)
    throw new Error('Invalid refresh token')
  if (Date.parse(session.expiresAt) <= Date.now())
    throw new Error('Invalid refresh token')

  const matrixAccount = await repository.findMatrixAccount(session.organizationId, session.userId)
  if (!matrixAccount)
    throw new Error('Matrix account not found')

  const accessToken = token()
  const refreshToken = token()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
  const newSession = await repository.createDeviceSession({
    organizationId: session.organizationId,
    userId: session.userId,
    deviceName: request.deviceName,
    accessTokenHash: sha256(`access:${accessToken}`),
    refreshTokenHash: sha256(`refresh:${refreshToken}`),
    expiresAt,
  })

  await repository.revokeDeviceSession(session.id)

  await repository.appendAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    action: 'oauth.token.refreshed',
    targetType: 'device_session',
    targetId: newSession.id,
    metadata: {
      previousSessionId: session.id,
      deviceName: request.deviceName,
    },
  })

  return {
    muonSession: {
      accessToken,
      refreshToken,
      expiresAt,
    },
    matrixSession: {
      serverUrl: matrixServerUrl,
      userId: matrixAccount.matrixUserId,
      accessToken: matrixAccount.accessToken,
      deviceId: matrixAccount.matrixDeviceId,
    },
  }
},
```

- [ ] **Step 7: Run tests**

Run: `pnpm vitest run tests/unit/enterprise/oauthRefresh.test.ts`
Expected: PASS (5 tests).

Run: `pnpm test:enterprise`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/oauth/oauthService.ts tests/unit/enterprise/oauthRefresh.test.ts
git commit -m "feat(api): support OAuth refresh with strict token rotation"
```

## Constraints

- The matrix session in the response is built from `matrix_accounts` row + the `matrixServerUrl` constructor argument. No `ensureUser` call.
- `oauth.token.refreshed` audit metadata includes BOTH the previous and the new session id — Phase 3's audit filter will use these.
- The `assertDesktopClientId` helper does NOT check redirect URI — refresh has no such concept.

---

## Task 6: Rename audit action `oauth.token.exchanged` → `oauth.token.issued`

So Phase 3's audit filter has clean code names for "first issuance" vs "refresh".

**Files:**
- Modify: `apps/api/src/modules/oauth/oauthService.ts`

- [ ] **Step 1: Rename in `exchangeCode`**

In `apps/api/src/modules/oauth/oauthService.ts`, find the existing audit log call in `exchangeCode`:

```ts
await repository.appendAuditLog({
  organizationId: authorizationCode.organizationId,
  actorUserId: authorizationCode.userId,
  action: 'oauth.token.exchanged',
  targetType: 'device_session',
  targetId: request.deviceName,
})
```

Change the action and target id (use the newly-created session id, which is more useful than the device name — make this change while you're here):

```ts
const newSession = await repository.createDeviceSession({
  // ...
})

await repository.appendAuditLog({
  organizationId: authorizationCode.organizationId,
  actorUserId: authorizationCode.userId,
  action: 'oauth.token.issued',
  targetType: 'device_session',
  targetId: newSession.id,
})
```

You'll need to capture the result of `createDeviceSession` (currently the call is fire-and-forget — its return value is unused). Pull it into `newSession`.

- [ ] **Step 2: Run all tests to confirm no audit-name assertion broke**

Run: `pnpm test:enterprise`
Expected: PASS. (No test currently asserts on `oauth.token.exchanged` — verified by grep before this plan was written.)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/oauth/oauthService.ts
git commit -m "refactor(api): rename oauth.token.exchanged → oauth.token.issued, target session id"
```

## Constraints

- Don't add a new test in this task — the rename is verified by absence of regression.
- DO capture `createDeviceSession`'s return value so you can use `newSession.id` as audit target.

---

## Task 7: `POST /api/oauth/refresh` route

Wire the new service method to HTTP.

**Files:**
- Modify: `apps/api/src/routes.ts`
- Test: `tests/unit/enterprise/apiRoutes.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `tests/unit/enterprise/apiRoutes.test.ts` (inside the existing `describe('enterprise api routes', ...)`):

```ts
it('POST /api/oauth/refresh issues a new session pair', async () => {
  const handler = createEnterpriseHttpHandler({
    matrix: {
      async ensureUser() {
        return { matrixUserId: '@acme.owner:localhost', accessToken: 'mx-1', deviceId: 'D1' }
      },
    },
    matrixServerUrl: 'http://localhost:6167',
  })

  // Install + OAuth flow to get a refreshToken.
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

  const loginRes = await handler.fetch(new Request('http://muon.test/api/oauth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
      clientId: 'muon-desktop',
      redirectUri: 'muon://auth/callback',
      codeChallenge: 'a'.repeat(43),
      codeChallengeMethod: 'plain',
      state: 'st',
    }),
  }))
  const loginPayload = await loginRes.json() as { code: string }

  const exchangeRes = await handler.fetch(new Request('http://muon.test/api/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      code: loginPayload.code,
      codeVerifier: 'a'.repeat(43),
      redirectUri: 'muon://auth/callback',
      clientId: 'muon-desktop',
      deviceName: 'Muon Desktop',
    }),
  }))
  const exchangePayload = await exchangeRes.json() as { muonSession: { accessToken: string, refreshToken: string } }

  const refreshRes = await handler.fetch(new Request('http://muon.test/api/oauth/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      refreshToken: exchangePayload.muonSession.refreshToken,
      clientId: 'muon-desktop',
      deviceName: 'Muon Desktop',
    }),
  }))
  expect(refreshRes.status).toBe(200)
  const refreshPayload = await refreshRes.json() as { muonSession: { accessToken: string, refreshToken: string } }
  expect(refreshPayload.muonSession.accessToken).not.toBe(exchangePayload.muonSession.accessToken)
  expect(refreshPayload.muonSession.refreshToken).not.toBe(exchangePayload.muonSession.refreshToken)
})

it('POST /api/oauth/refresh rejects an unknown refresh token with 400', async () => {
  const handler = createEnterpriseHttpHandler()
  const response = await handler.fetch(new Request('http://muon.test/api/oauth/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      refreshToken: 'never-issued',
      clientId: 'muon-desktop',
      deviceName: 'Muon Desktop',
    }),
  }))
  expect(response.status).toBe(400)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/enterprise/apiRoutes.test.ts`
Expected: FAIL — `/api/oauth/refresh` returns 404.

- [ ] **Step 3: Add the route**

In `apps/api/src/routes.ts`, inside the `fetch(request)` chain. Place this block JUST AFTER the existing `/api/oauth/token` handler (around line 320):

```ts
if (url.pathname === '/api/oauth/refresh') {
  if (request.method !== 'POST')
    return methodNotAllowed()
  const result = await oauthService.refresh(await readJsonBody(request) as never)
  return withCors(jsonResponse(result), request)
}
```

`readJsonBody`, `methodNotAllowed`, `jsonResponse`, `withCors`, `oauthService` are all in scope.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/enterprise/apiRoutes.test.ts`
Expected: PASS — 14 existing + 2 new = 16 tests.

Run: `pnpm test:enterprise`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes.ts tests/unit/enterprise/apiRoutes.test.ts
git commit -m "feat(api): expose POST /api/oauth/refresh"
```

## Constraints

- No auth header — the refresh token in the body IS the credential. Same pattern as `/api/oauth/token`.
- Errors from `oauthService.refresh` (e.g., `'Invalid refresh token'`) flow through the existing `errorResponse` regex (matches `/invalid/`) → 400.

---

## Task 8: `GET /api/admin/users/:userId/sessions`

List a user's active device sessions. requireFullyAuthorizedAdmin.

**Files:**
- Modify: `apps/api/src/routes.ts`
- Test: `tests/unit/enterprise/apiRoutes.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `tests/unit/enterprise/apiRoutes.test.ts`:

```ts
async function setupAdminWithDeviceSession() {
  const repository = createInMemoryEnterpriseRepository()
  const handler = createEnterpriseHttpHandler({
    repository,
    matrix: {
      async ensureUser() {
        return { matrixUserId: '@acme.owner:localhost', accessToken: 'mx-1', deviceId: 'D1' }
      },
    },
    matrixServerUrl: 'http://localhost:6167',
  })

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

  // Get a desktop session for the owner.
  const loginRes = await handler.fetch(new Request('http://muon.test/api/oauth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
      clientId: 'muon-desktop',
      redirectUri: 'muon://auth/callback',
      codeChallenge: 'a'.repeat(43),
      codeChallengeMethod: 'plain',
      state: 'st',
    }),
  }))
  const code = (await loginRes.json() as { code: string }).code

  await handler.fetch(new Request('http://muon.test/api/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      code,
      codeVerifier: 'a'.repeat(43),
      redirectUri: 'muon://auth/callback',
      clientId: 'muon-desktop',
      deviceName: 'Muon Desktop',
    }),
  }))

  // Admin login for the owner.
  const adminLogin = await handler.fetch(new Request('http://muon.test/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
    }),
  }))
  const adminToken = (await adminLogin.json() as { session: { accessToken: string }, user: { id: string } }).session.accessToken
  const ownerId = (await (await handler.fetch(new Request('http://muon.test/api/admin/me', {
    headers: { authorization: `Bearer ${adminToken}` },
  }))).json() as { user: { id: string } }).user.id

  return { handler, adminToken, ownerId, repository }
}

it('GET /api/admin/users/:userId/sessions returns active desktop sessions without hashes', async () => {
  const { handler, adminToken, ownerId } = await setupAdminWithDeviceSession()
  const response = await handler.fetch(new Request(`http://muon.test/api/admin/users/${ownerId}/sessions`, {
    headers: { authorization: `Bearer ${adminToken}` },
  }))
  expect(response.status).toBe(200)
  const payload = await response.json() as { sessions: Array<{ id: string, deviceName: string, createdAt: string, expiresAt: string }> }
  expect(payload.sessions.length).toBe(1)
  expect(payload.sessions[0].deviceName).toBe('Muon Desktop')
  // No hash fields leaked.
  expect((payload.sessions[0] as Record<string, unknown>).accessTokenHash).toBeUndefined()
  expect((payload.sessions[0] as Record<string, unknown>).refreshTokenHash).toBeUndefined()
})

it('GET /api/admin/users/:userId/sessions requires fully authorized admin (403 for must-change)', async () => {
  const { handler, token: mustChangeToken, ownerId } = await setupMustChangeOwner()
  const response = await handler.fetch(new Request(`http://muon.test/api/admin/users/${ownerId}/sessions`, {
    headers: { authorization: `Bearer ${mustChangeToken}` },
  }))
  expect(response.status).toBe(403)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/enterprise/apiRoutes.test.ts`
Expected: FAIL — `/api/admin/users/.../sessions` returns 404 (route not implemented).

- [ ] **Step 3: Add the path-match helper and route**

In `apps/api/src/routes.ts`, near the existing `adminUserRoute` helper (around line 94), add a similar helper for the sessions sub-resource:

```ts
function adminUserSessionsRoute(pathname: string): { userId: string, sessionId?: string } | null {
  const match = /^\/api\/admin\/users\/([^/]+)\/sessions(?:\/([^/]+))?$/.exec(pathname)
  if (!match)
    return null
  return {
    userId: decodeURIComponent(match[1]),
    sessionId: match[2] ? decodeURIComponent(match[2]) : undefined,
  }
}
```

Also add a helper that strips hash fields from a `DeviceSessionRecord`. Place it near the other formatting helpers in the file:

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

Update the type imports at the top of `apps/api/src/routes.ts`. The current import line is:

```ts
import type { MatrixProvisioningAdapter } from './modules/matrix/provisioning'
import type { EnterpriseRepository, EnterpriseUserRecord } from './repository'
```

Add `DeviceSessionRecord`:

```ts
import type { MatrixProvisioningAdapter } from './modules/matrix/provisioning'
import type { DeviceSessionRecord, EnterpriseRepository, EnterpriseUserRecord } from './repository'
```

And `DeviceSessionPublic`:

```ts
import type { DeviceSessionPublic } from '@muon/enterprise-contracts'
```

Add this import line just below the other type-only imports.

Add the GET route handler inside the `fetch(request)` chain. Place it AFTER the existing `adminUserRoute` block (single-user PATCH/password) and BEFORE the `/api/admin/audit-logs` block:

```ts
const sessionsRoute = adminUserSessionsRoute(url.pathname)
if (sessionsRoute && !sessionsRoute.sessionId) {
  const actor = await requireFullyAuthorizedAdmin(request)
  if (request.method !== 'GET')
    return methodNotAllowed()
  const sessions = await repository.findActiveDeviceSessionsByUser(actor.organizationId, sessionsRoute.userId)
  return withCors(jsonResponse({
    sessions: sessions.map(toDeviceSessionPublic),
  }), request)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/enterprise/apiRoutes.test.ts`
Expected: PASS — 16 + 2 = 18 tests.

Run: `pnpm test:enterprise`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes.ts tests/unit/enterprise/apiRoutes.test.ts
git commit -m "feat(api): list active device sessions for a user"
```

## Constraints

- Use `actor.organizationId` (NOT `sessionsRoute.userId` to look up org) — this prevents cross-org session viewing if admin compromises an id.
- Return `{ sessions: [...] }`, not `[...]` directly — consistent with `/api/admin/users`, `/api/admin/organizations` envelope.

---

## Task 9: `DELETE /api/admin/users/:userId/sessions/:sessionId`

Revoke a single device session.

**Files:**
- Modify: `apps/api/src/routes.ts`
- Test: `tests/unit/enterprise/apiRoutes.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `tests/unit/enterprise/apiRoutes.test.ts`:

```ts
it('DELETE /api/admin/users/:userId/sessions/:sessionId revokes the session', async () => {
  const { handler, adminToken, ownerId, repository } = await setupAdminWithDeviceSession()
  const sessionId = repository.deviceSessions[0].id

  const del = await handler.fetch(new Request(`http://muon.test/api/admin/users/${ownerId}/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${adminToken}` },
  }))
  expect(del.status).toBe(200)
  expect(await del.json()).toEqual({ ok: true })

  // The session is no longer returned by GET.
  const list = await handler.fetch(new Request(`http://muon.test/api/admin/users/${ownerId}/sessions`, {
    headers: { authorization: `Bearer ${adminToken}` },
  }))
  const payload = await list.json() as { sessions: Array<{ id: string }> }
  expect(payload.sessions.find(s => s.id === sessionId)).toBeUndefined()
})

it('DELETE /api/admin/users/:userId/sessions/:sessionId is idempotent on unknown ids', async () => {
  const { handler, adminToken, ownerId } = await setupAdminWithDeviceSession()
  const del = await handler.fetch(new Request(`http://muon.test/api/admin/users/${ownerId}/sessions/not-a-session`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${adminToken}` },
  }))
  expect(del.status).toBe(200)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/enterprise/apiRoutes.test.ts`
Expected: FAIL — DELETE returns 405 (method not allowed) or 404 because the existing GET block only handles GET.

- [ ] **Step 3: Add the DELETE branch**

In `apps/api/src/routes.ts`, just AFTER the GET sessions block from Task 8, add:

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/enterprise/apiRoutes.test.ts`
Expected: PASS — 18 + 2 = 20 tests.

Run: `pnpm test:enterprise`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes.ts tests/unit/enterprise/apiRoutes.test.ts
git commit -m "feat(api): revoke device session via admin DELETE"
```

## Constraints

- `revokeDeviceSession` is already idempotent — calling on unknown id is a 200 no-op.
- The audit log fires REGARDLESS of whether the session existed. This is acceptable for an admin action; an audit row of "admin attempted to revoke session X which didn't exist" is not harmful.

---

## Task 10: Admin frontend — `listUserDeviceSessions` + `revokeUserDeviceSession` API clients

**Files:**
- Modify: `apps/admin/src/api.ts`

- [ ] **Step 1: Append the two functions**

At the top of `apps/admin/src/api.ts`, add `DeviceSessionPublic` to the existing contracts import. The current import looks like:

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

Add `DeviceSessionPublic` (alphabetical, after `CreateUserRequest`):

```ts
import type {
  AdminLoginRequest,
  AuditLog,
  ChangeOwnPasswordRequest,
  CreateOrganizationRequest,
  CreateUserRequest,
  DeviceSessionPublic,
  EnterpriseUser,
  InstallRequest,
  MuonSession,
  Organization,
  ResetPasswordRequest,
  UpdateUserRequest,
} from '@muon/enterprise-contracts'
```

At the end of `apps/admin/src/api.ts`, append:

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

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @muon/admin build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/api.ts
git commit -m "feat(admin): add device-session list + revoke clients"
```

## Constraints

- No tests in this task — Task 11's component tests exercise both functions through mocks.
- Use `encodeURIComponent` on both path segments (consistent with existing functions in the file).

---

## Task 11: Admin UI — lazy-loaded device-session panel + tests

Adds a `<details>`-based expandable panel under each user's reset-password form. Listing is on-demand (lazy) on first expand.

**Files:**
- Modify: `apps/admin/src/AdminApp.vue`
- Test: `tests/components/AdminApp.test.ts`

- [ ] **Step 1: Add mocks for the two new API functions**

In `tests/components/AdminApp.test.ts`, find the `vi.mock('../../apps/admin/src/api', () => ({...}))` block. Add:

```ts
listUserDeviceSessions: vi.fn(async () => ({
  sessions: [
    {
      id: 'session-1',
      deviceName: 'Muon Desktop',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    },
  ],
})),
revokeUserDeviceSession: vi.fn(async () => ({ ok: true })),
```

Place alphabetically — `listUserDeviceSessions` near other `list*` mocks, `revokeUserDeviceSession` near `resetAdminUserPassword`.

Update the destructured imports at the top of the test file. Add `listUserDeviceSessions` and `revokeUserDeviceSession`:

```ts
import {
  changeOwnPassword,
  createAdminUser,
  createOrganization,
  getAdminMe,
  listAuditLogs,
  listOrganizations,
  listUserDeviceSessions,
  listUsers,
  loginAdmin,
  logoutAdmin,
  resetAdminUserPassword,
  revokeUserDeviceSession,
  updateAdminUser,
} from '../../apps/admin/src/api'
```

- [ ] **Step 2: Append failing tests**

Inside `describe('adminApp', ...)`, append:

```ts
it('expanding a user\'s sessions panel lazy-loads sessions and shows the device list', async () => {
  window.localStorage.setItem('muon_admin_token', 'session-token')
  const wrapper = mount(AdminApp, {
    props: { initialInstalled: true },
    global: {
      plugins: [createAdminRouter(createMemoryHistory())],
    },
  })
  await flushPromises()

  // Navigate to users panel (only place that shows sessions panel)
  await wrapper.find('a[data-section="users"]').trigger('click')
  await flushPromises()

  // Sessions are NOT yet loaded.
  expect(listUserDeviceSessions).not.toHaveBeenCalled()

  // Expand the first user's sessions panel.
  const summary = wrapper.find('[data-testid="user-sessions-summary-user-owner"]')
  await summary.trigger('click')
  await flushPromises()

  expect(listUserDeviceSessions).toHaveBeenCalledWith('session-token', 'user-owner')
  expect(wrapper.find('[data-testid="user-sessions-row-session-1"]').exists()).toBe(true)
  expect(wrapper.text()).toContain('Muon Desktop')
})

it('toggling the sessions panel a second time does not refetch', async () => {
  window.localStorage.setItem('muon_admin_token', 'session-token')
  const wrapper = mount(AdminApp, {
    props: { initialInstalled: true },
    global: {
      plugins: [createAdminRouter(createMemoryHistory())],
    },
  })
  await flushPromises()
  await wrapper.find('a[data-section="users"]').trigger('click')
  await flushPromises()

  const summary = wrapper.find('[data-testid="user-sessions-summary-user-owner"]')
  await summary.trigger('click') // open, loads
  await flushPromises()
  await summary.trigger('click') // close
  await flushPromises()
  await summary.trigger('click') // open again, should NOT refetch
  await flushPromises()

  expect(listUserDeviceSessions).toHaveBeenCalledTimes(1)
})

it('clicking 吊销 on a session calls revokeUserDeviceSession and removes the row', async () => {
  window.localStorage.setItem('muon_admin_token', 'session-token')
  const wrapper = mount(AdminApp, {
    props: { initialInstalled: true },
    global: {
      plugins: [createAdminRouter(createMemoryHistory())],
    },
  })
  await flushPromises()
  await wrapper.find('a[data-section="users"]').trigger('click')
  await flushPromises()
  await wrapper.find('[data-testid="user-sessions-summary-user-owner"]').trigger('click')
  await flushPromises()

  await wrapper.find('[data-testid="user-sessions-revoke-session-1"]').trigger('click')
  await flushPromises()

  expect(revokeUserDeviceSession).toHaveBeenCalledWith('session-token', 'user-owner', 'session-1')
  expect(wrapper.find('[data-testid="user-sessions-row-session-1"]').exists()).toBe(false)
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run tests/components/AdminApp.test.ts`
Expected: FAIL — `[data-testid="user-sessions-summary-user-owner"]` does not exist.

- [ ] **Step 4: Update `AdminApp.vue`**

In `apps/admin/src/AdminApp.vue`:

**4a.** Update the `./api` import line at the top of `<script setup>` to add `listUserDeviceSessions` and `revokeUserDeviceSession`:

```ts
import { changeOwnPassword, createAdminUser, createOrganization, getAdminMe, installMuon, listAuditLogs, listOrganizations, listUserDeviceSessions, listUsers, loginAdmin, logoutAdmin, resetAdminUserPassword, revokeUserDeviceSession, updateAdminUser } from './api'
```

Add the contracts import for the public DTO type:

```ts
import type { ..., DeviceSessionPublic } from '@muon/enterprise-contracts'
```

(Locate the existing `import type` block in the file — likely the first imports — and add `DeviceSessionPublic` alphabetically.)

**4b.** Add reactive state near the other reactive() / ref() declarations:

```ts
const expandedSessions = reactive<Record<string, boolean>>({})
const userSessions = reactive<Record<string, DeviceSessionPublic[]>>({})
const sessionLoading = reactive<Record<string, boolean>>({})
const revokingSession = reactive<Record<string, boolean>>({})
```

**4c.** Add the handler functions near `submitUpdateUser` / `submitResetUserPassword`:

```ts
async function toggleUserSessions(userId: string) {
  if (!adminToken.value)
    return
  expandedSessions[userId] = !expandedSessions[userId]
  if (expandedSessions[userId] && !userSessions[userId]) {
    sessionLoading[userId] = true
    try {
      const { sessions } = await listUserDeviceSessions(adminToken.value, userId)
      userSessions[userId] = sessions
    }
    catch (err) {
      userError.value = err instanceof Error ? err.message : '加载会话失败'
    }
    finally {
      sessionLoading[userId] = false
    }
  }
}

async function revokeSession(userId: string, sessionId: string) {
  if (!adminToken.value || revokingSession[sessionId])
    return
  revokingSession[sessionId] = true
  try {
    await revokeUserDeviceSession(adminToken.value, userId, sessionId)
    userSessions[userId] = (userSessions[userId] ?? []).filter(s => s.id !== sessionId)
  }
  catch (err) {
    userError.value = err instanceof Error ? err.message : '吊销失败'
  }
  finally {
    revokingSession[sessionId] = false
  }
}
```

**4d.** In the template, find the existing user row (inside the users panel — `v-for="user in filteredUsers"`). After the `<form class="password-form" ...>` block, add the sessions panel:

```html
<details
  class="user-sessions"
  :open="expandedSessions[user.id]"
  @toggle="(event) => {
    if ((event.target as HTMLDetailsElement).open !== expandedSessions[user.id])
      toggleUserSessions(user.id)
  }"
>
  <summary :data-testid="`user-sessions-summary-${user.id}`">
    活跃会话 <span v-if="userSessions[user.id]">({{ userSessions[user.id].length }})</span>
  </summary>
  <div v-if="sessionLoading[user.id]" class="user-sessions-loading">
    加载中…
  </div>
  <div v-else-if="userSessions[user.id]?.length === 0" class="empty-state">
    没有活跃会话
  </div>
  <div v-else class="user-sessions-list">
    <div
      v-for="session in userSessions[user.id]"
      :key="session.id"
      class="user-sessions-row"
      :data-testid="`user-sessions-row-${session.id}`"
    >
      <strong>{{ session.deviceName }}</strong>
      <span>创建于 {{ formatDate(session.createdAt) }}</span>
      <span>过期于 {{ formatDate(session.expiresAt) }}</span>
      <Button
        type="button"
        variant="outline"
        :data-testid="`user-sessions-revoke-${session.id}`"
        :disabled="revokingSession[session.id]"
        @click="revokeSession(user.id, session.id)"
      >
        {{ revokingSession[session.id] ? '正在吊销' : '吊销' }}
      </Button>
    </div>
  </div>
</details>
```

The `@toggle` handler is what triggers lazy-load when the user expands. The toggle event fires both on open AND close — the guard `(event.target as HTMLDetailsElement).open !== expandedSessions[user.id]` prevents double-invocation when the open-state is set by clicking; but the test triggers `click` on the `<summary>`, which is what the native control listens for.

Actually, simpler: the click event on `<summary>` is what toggles the `<details>` native. Let me reconsider — for the test, `await summary.trigger('click')` fires a click on the summary, which in jsdom causes the `<details>` to toggle its `open` attribute. The `@toggle` Vue listener should then fire. Test the behavior in your dev cycle.

If the `@toggle` approach is flaky in jsdom, use a click handler on the `<summary>` directly:

```html
<details class="user-sessions" :open="expandedSessions[user.id]">
  <summary
    :data-testid="`user-sessions-summary-${user.id}`"
    @click.prevent="toggleUserSessions(user.id)"
  >
    活跃会话 <span v-if="userSessions[user.id]">({{ userSessions[user.id].length }})</span>
  </summary>
  ...
</details>
```

`@click.prevent` stops the native toggle; `toggleUserSessions` controls `expandedSessions[user.id]`, which is bound to `:open`. This is more reliable.

**Use the `@click.prevent` version.**

**4e.** Add scoped CSS to the `<style scoped>` block:

```css
.user-sessions {
  margin-top: 8px;
  padding: 8px;
  background: #f6f7f9;
  border-radius: 6px;
}

.user-sessions summary {
  cursor: pointer;
  user-select: none;
  font-weight: 600;
  font-size: 13px;
}

.user-sessions-loading {
  padding: 12px;
  color: #667085;
  font-size: 13px;
}

.user-sessions-list {
  margin-top: 8px;
  display: grid;
  gap: 6px;
}

.user-sessions-row {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 8px;
  background: #fff;
  border: 1px solid #edf0f4;
  border-radius: 6px;
  font-size: 13px;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/components/AdminApp.test.ts`
Expected: PASS (24 + 3 = 27 tests).

Run: `pnpm test:enterprise`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/AdminApp.vue tests/components/AdminApp.test.ts
git commit -m "feat(admin): per-user device-session panel with lazy load + revoke"
```

## Constraints

- DON'T pre-load sessions on dashboard refresh — lazy expand only.
- DON'T add a "revoke all" button — Phase 2 only supports single revoke.
- The `@click.prevent` on `<summary>` is required to prevent jsdom from racing with the native `<details>` toggle. Test in browser if behavior feels off.

---

## Task 12: Desktop `refreshEnterpriseSession` helper + tests

The standalone helper that posts the stored refresh token to `/api/oauth/refresh` and updates local storage.

**Files:**
- Modify: `src/matrix/auth.ts`
- Test: `tests/unit/auth.test.ts` (new — if no test for auth.ts exists; check)

- [ ] **Step 1: Check whether tests for auth.ts exist**

Run: `ls tests/unit/auth.test.ts 2>/dev/null && echo "exists" || echo "missing"`
Run: `find tests -name "auth*.test.ts" -not -path "*/enterprise/*"`

If a test file already exists, use it. Otherwise, create `tests/unit/auth.test.ts`. Either way, the test code below goes inside.

- [ ] **Step 2: Write failing test**

Create or append to `tests/unit/auth.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ENTERPRISE_SESSION_KEY = 'muon_enterprise_session'

describe('refreshEnterpriseSession', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('posts the stored refresh token and persists the new muon session', async () => {
    // Seed localStorage with a muon session (unencrypted form — safeStorage isn't available in jsdom).
    window.localStorage.setItem(ENTERPRISE_SESSION_KEY, JSON.stringify({
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    }))

    const newPayload = {
      muonSession: {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresAt: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
      },
      matrixSession: {
        serverUrl: 'http://localhost:6167',
        userId: '@acme.owner:localhost',
        accessToken: 'mx-1',
        deviceId: 'D1',
      },
    }
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(newPayload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { refreshEnterpriseSession } = await import('@/matrix/auth')
    await refreshEnterpriseSession('http://muon.test')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://muon.test/api/oauth/refresh',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          refreshToken: 'old-refresh',
          clientId: 'muon-desktop',
          deviceName: 'Muon Desktop',
        }),
      }),
    )

    const stored = JSON.parse(window.localStorage.getItem(ENTERPRISE_SESSION_KEY) ?? '{}')
    expect(stored.accessToken).toBe('new-access')
    expect(stored.refreshToken).toBe('new-refresh')
  })

  it('clears the enterprise session when refresh returns 400', async () => {
    window.localStorage.setItem(ENTERPRISE_SESSION_KEY, JSON.stringify({
      accessToken: 'old-access',
      refreshToken: 'stale-refresh',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    }))

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Invalid refresh token' }), { status: 400 })))

    const { refreshEnterpriseSession } = await import('@/matrix/auth')
    await refreshEnterpriseSession('http://muon.test')

    expect(window.localStorage.getItem(ENTERPRISE_SESSION_KEY)).toBe(null)
  })

  it('is a no-op when no enterprise session is stored', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { refreshEnterpriseSession } = await import('@/matrix/auth')
    await refreshEnterpriseSession('http://muon.test')

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/auth.test.ts`
Expected: FAIL — `refreshEnterpriseSession is not exported` (or similar).

- [ ] **Step 4: Implement `refreshEnterpriseSession`**

In `src/matrix/auth.ts`, near the top of the file, add a small helper to read the stored muonSession (the existing inline code in `completeEnterpriseLogin` does this — extract it):

```ts
interface MuonSessionStored {
  accessToken: string
  refreshToken: string
  expiresAt: string
}

async function readStoredMuonSession(): Promise<MuonSessionStored | null> {
  const raw = localStorage.getItem(ENTERPRISE_SESSION_KEY)
  if (!raw)
    return null

  try {
    const parsed = JSON.parse(raw)
    if (parsed?._enc === true) {
      const decrypted = await decryptSensitive(parsed.data, true)
      return JSON.parse(decrypted) as MuonSessionStored
    }
    return parsed as MuonSessionStored
  }
  catch {
    return null
  }
}

async function persistMuonSession(session: MuonSessionStored): Promise<void> {
  const json = JSON.stringify(session)
  const encrypted = await encryptSensitive(json)
  const payload = encrypted !== json
    ? JSON.stringify({ _enc: true, data: encrypted })
    : json
  localStorage.setItem(ENTERPRISE_SESSION_KEY, payload)
}
```

Add the exported helper near the bottom of the file, before `restoreSession`:

```ts
export async function refreshEnterpriseSession(
  apiBaseUrl = import.meta.env.VITE_MUON_API_BASE_URL,
): Promise<void> {
  const baseUrl = enterpriseApiBaseUrl(apiBaseUrl)
  if (!baseUrl)
    return

  const stored = await readStoredMuonSession()
  if (!stored?.refreshToken)
    return

  let response: Response
  try {
    response = await fetch(`${baseUrl}/api/oauth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        refreshToken: stored.refreshToken,
        clientId: 'muon-desktop',
        deviceName: 'Muon Desktop',
      }),
    })
  }
  catch {
    // Network error — keep the existing session, try again next startup.
    return
  }

  if (!response.ok) {
    // 400 / 401 — refresh token invalid. Clear the session, user re-authenticates.
    localStorage.removeItem(ENTERPRISE_SESSION_KEY)
    return
  }

  const payload = oauthTokenResponseSchema.parse(await response.json())
  await persistMuonSession(payload.muonSession)
  // matrixSession is unchanged from server side; the locally stored Matrix session (STORAGE_KEY)
  // is fine to leave alone.
}
```

**Important:** the existing `completeEnterpriseLogin` function (lines 287-292) has inline encryption logic for muonSession. Now that `persistMuonSession` exists, refactor `completeEnterpriseLogin` to use it:

Replace this block in `completeEnterpriseLogin`:

```ts
// Encrypt the enterprise muonSession (contains accessToken + refreshToken)
const muonSessionJson = JSON.stringify(tokenResponse.muonSession)
const encryptedMuonSession = await encryptSensitive(muonSessionJson)
const muonPayload = encryptedMuonSession !== muonSessionJson
  ? JSON.stringify({ _enc: true, data: encryptedMuonSession })
  : muonSessionJson
localStorage.setItem(ENTERPRISE_SESSION_KEY, muonPayload)
```

with:

```ts
await persistMuonSession(tokenResponse.muonSession)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/auth.test.ts`
Expected: PASS (3 tests).

Run: `pnpm test:enterprise`
Expected: PASS.

Run: `pnpm type-check`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/matrix/auth.ts tests/unit/auth.test.ts
git commit -m "feat(desktop): refreshEnterpriseSession helper for muon-side rotation"
```

## Constraints

- Network errors do NOT clear the session — only 4xx responses do. A flaky network shouldn't kick users.
- `persistMuonSession` is reused by `completeEnterpriseLogin` — refactor to use it for DRY.
- The matrix session in localStorage (`STORAGE_KEY`) is NOT touched by refresh — the server returns the same matrix credentials, so local storage matches.

---

## Task 13: Desktop `maybeRefreshOnStartup` hook in `restoreSession`

The trigger that actually invokes `refreshEnterpriseSession` near expiry on app startup.

**Files:**
- Modify: `src/matrix/auth.ts`
- Test: `tests/unit/auth.test.ts` (extend)

- [ ] **Step 1: Append failing tests**

Append to `tests/unit/auth.test.ts`:

```ts
describe('maybeRefreshOnStartup', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('refreshes when expiry is within 24h', async () => {
    window.localStorage.setItem(ENTERPRISE_SESSION_KEY, JSON.stringify({
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      // 1h until expiry — well within the 24h refresh window
      expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
    }))

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      muonSession: {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresAt: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
      },
      matrixSession: {
        serverUrl: 'http://localhost:6167',
        userId: '@acme.owner:localhost',
        accessToken: 'mx-1',
        deviceId: 'D1',
      },
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('VITE_MUON_API_BASE_URL', 'http://muon.test')

    const { maybeRefreshOnStartup } = await import('@/matrix/auth')
    await maybeRefreshOnStartup()

    expect(fetchMock).toHaveBeenCalled()
    const stored = JSON.parse(window.localStorage.getItem(ENTERPRISE_SESSION_KEY) ?? '{}')
    expect(stored.accessToken).toBe('new-access')
  })

  it('does not refresh when expiry is far away', async () => {
    window.localStorage.setItem(ENTERPRISE_SESSION_KEY, JSON.stringify({
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      // 25 days until expiry — far outside the 24h window
      expiresAt: new Date(Date.now() + 25 * 24 * 3600_000).toISOString(),
    }))

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { maybeRefreshOnStartup } = await import('@/matrix/auth')
    await maybeRefreshOnStartup()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('is a no-op when no enterprise session is stored', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { maybeRefreshOnStartup } = await import('@/matrix/auth')
    await maybeRefreshOnStartup()

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/auth.test.ts`
Expected: FAIL — `maybeRefreshOnStartup is not exported`.

- [ ] **Step 3: Implement and integrate**

In `src/matrix/auth.ts`:

**3a.** Add the constant and the function near `refreshEnterpriseSession`:

```ts
const REFRESH_NEAR_EXPIRY_MS = 24 * 60 * 60 * 1000

export async function maybeRefreshOnStartup(apiBaseUrl = import.meta.env.VITE_MUON_API_BASE_URL): Promise<void> {
  const stored = await readStoredMuonSession()
  if (!stored)
    return
  const msUntilExpiry = Date.parse(stored.expiresAt) - Date.now()
  if (msUntilExpiry < REFRESH_NEAR_EXPIRY_MS)
    await refreshEnterpriseSession(apiBaseUrl).catch(() => {})
}
```

**3b.** Wire `maybeRefreshOnStartup` into `restoreSession`. The current `restoreSession` looks like:

```ts
export async function restoreSession(): Promise<boolean> {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw)
    return false
  // ... rest
}
```

Add the refresh call at the TOP, before reading `STORAGE_KEY`:

```ts
export async function restoreSession(): Promise<boolean> {
  await maybeRefreshOnStartup()

  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw)
    return false
  // ... rest unchanged
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/auth.test.ts`
Expected: PASS (6 tests — 3 from Task 12 + 3 new).

- [ ] **Step 5: Final full-suite check**

Run: `pnpm test:enterprise`
Expected: PASS.

Run: `pnpm type-check`
Expected: exit 0.

Run: `pnpm lint`
Expected: exit 0 (or only pre-existing issues unrelated to this branch).

- [ ] **Step 6: Commit**

```bash
git add src/matrix/auth.ts tests/unit/auth.test.ts
git commit -m "feat(desktop): refresh enterprise session on startup near expiry"
```

## Constraints

- `maybeRefreshOnStartup` catches errors silently — it must NEVER throw, so `restoreSession` doesn't crash on transient network issues.
- The threshold is `< REFRESH_NEAR_EXPIRY_MS`, not `<=`. Boundary doesn't matter at 24h granularity.

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
Expected: exit 0 (or only pre-existing issues).

- [ ] **Step 4: Audit route distribution**

Run:

```bash
grep -n "requireAdmin\|requireFullyAuthorizedAdmin" apps/api/src/routes.ts
```

You should see:
- 2 declarations
- 3 `requireAdmin` call sites (`/api/admin/me`, `/api/admin/logout`, `/api/admin/me/password`)
- 5 `requireFullyAuthorizedAdmin` call sites (`/api/admin/organizations`, `/api/admin/users`, `adminUserRoute`, `/api/admin/audit-logs`, `adminUserSessionsRoute` for both GET and DELETE — but they share one `requireFullyAuthorizedAdmin` call each since they're in two separate `if` blocks. Count is 6 if you count each block.)

Actually after Tasks 8 and 9, both blocks call `requireFullyAuthorizedAdmin` separately — so the count is 6.

- [ ] **Step 5: Manual smoke test (optional)**

```bash
pnpm services:up
pnpm dev:api      # terminal 1
pnpm dev:admin    # terminal 2
pnpm dev:desktop  # terminal 3
```

1. Install + log in admin web. Verify users panel shows owner.
2. From the desktop app, complete enterprise OAuth login (will create a device_sessions row).
3. In admin web, expand 活跃会话 under the owner row. You should see "Muon Desktop · created · expires".
4. Click 吊销 on the session. Row disappears.
5. Restart desktop app within 24h of expiry (you'll have to manually shorten expiry in the DB or wait, depending on what you want to verify). On startup, refresh should fire and update the localStorage entry.
