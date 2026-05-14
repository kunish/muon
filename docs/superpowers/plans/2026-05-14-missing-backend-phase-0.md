# Missing Backend — Phase 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-memory `adminTokens` Map with a DB-backed admin session validated through `adminSessionService`, and have the admin web app validate its stored token on bootstrap via `GET /api/admin/me`.

**Architecture:** Add an `admin_sessions` table, store SHA-256 hashes of access/refresh tokens (never plaintext), expose `validate(token)` and `revoke(token)` from `adminSessionService`, replace the route-level `adminTokens` Map with calls into that service, and map `AdminAuthenticationError` to HTTP 401. On the admin frontend, call `GET /api/admin/me` once on mount and clear localStorage on 401.

**Tech Stack:** TypeScript, Node `node:http`, `pg`, Vitest + `@vue/test-utils`, Vue 3, Postgres 16. All tests run via the repo-root `vitest.config.ts` (no separate test runner for `apps/api`).

**Reference spec:** `docs/superpowers/specs/2026-05-14-missing-backend-phase-0-design.md`

---

## File Structure

**Create:**
- `apps/api/src/db/migrations/0002_admin_sessions.sql` — schema for the new table
- `tests/unit/enterprise/adminSessionService.test.ts` — login/validate/revoke unit tests
- `tests/unit/enterprise/adminSessionRepository.test.ts` — repository methods
- `tests/unit/enterprise/migrationRunner.test.ts` — `loadMigrationFiles` unit test

**Modify:**
- `apps/api/src/repository.ts` — add 5 new methods + types to interface, in-memory impls
- `apps/api/src/db/postgresRepository.ts` — Postgres impl of 5 methods + new migration loader
- `apps/api/src/modules/auth/adminSessionService.ts` — error class, persistence on login, `validate`, `revoke`
- `apps/api/src/routes.ts` — drop `adminTokens` Map, route requireAdmin through service, extend `errorResponse`
- `apps/admin/src/api.ts` — add `getAdminMe`
- `apps/admin/src/AdminApp.vue` — replace bare `refreshDashboard()` call with `bootstrap()` that hits `/api/admin/me` first
- `tests/components/AdminApp.test.ts` — add bootstrap behavior tests; extend `vi.mock` with `getAdminMe`

---

## Task 1: Migration runner reads every `.sql` in `migrations/`

The current `migratePostgres` reads exactly `0001_enterprise_core.sql`. Phase 0 adds `0002_admin_sessions.sql`, so the runner must read every file in the directory and execute them in sorted order. Existing DDL is fully `IF NOT EXISTS`, so re-execution is idempotent — no `schema_migrations` tracking table needed yet.

**Files:**
- Modify: `apps/api/src/db/postgresRepository.ts:98-101` (replace `migratePostgres`, export new `loadMigrationFiles`)
- Test: `tests/unit/enterprise/migrationRunner.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/enterprise/migrationRunner.test.ts`:

```ts
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadMigrationFiles } from '../../../apps/api/src/db/postgresRepository'

describe('loadMigrationFiles', () => {
  it('returns every .sql file in lexicographic order with its contents', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'muon-migrations-'))
    await writeFile(join(dir, '0002_second.sql'), '-- second')
    await writeFile(join(dir, '0001_first.sql'), '-- first')
    await writeFile(join(dir, 'README.md'), 'ignored')

    const dirUrl = new URL(`${pathToFileURL(dir).href}/`)
    const files = await loadMigrationFiles(dirUrl)

    expect(files.map(file => file.name)).toEqual(['0001_first.sql', '0002_second.sql'])
    expect(files[0].sql).toBe('-- first')
    expect(files[1].sql).toBe('-- second')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/enterprise/migrationRunner.test.ts`
Expected: FAIL with `loadMigrationFiles is not exported` (or a similar import error).

- [ ] **Step 3: Implement `loadMigrationFiles` and rewrite `migratePostgres`**

In `apps/api/src/db/postgresRepository.ts`, replace the `migratePostgres` function and its `readFile` import with the following block. Keep the existing `import { Pool } from 'pg'`.

Replace this line:

```ts
import { readFile } from 'node:fs/promises'
```

with:

```ts
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
```

Then replace the existing `migratePostgres` function body with:

```ts
export interface MigrationFile {
  name: string
  sql: string
}

export async function loadMigrationFiles(dirUrl: URL): Promise<MigrationFile[]> {
  const dirPath = fileURLToPath(dirUrl)
  const entries = await readdir(dirPath)
  const sqlFiles = entries.filter(entry => entry.endsWith('.sql')).sort()
  return Promise.all(sqlFiles.map(async (name) => {
    const sql = await readFile(new URL(name, dirUrl), 'utf8')
    return { name, sql }
  }))
}

export async function migratePostgres(pool: Pool): Promise<void> {
  const migrations = await loadMigrationFiles(new URL('./migrations/', import.meta.url))
  for (const migration of migrations)
    await pool.query(migration.sql)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/enterprise/migrationRunner.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Run the full enterprise test suite to confirm no regression**

Run: `pnpm test:enterprise`
Expected: PASS (existing tests still green because all current DDL is `IF NOT EXISTS`).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/db/postgresRepository.ts tests/unit/enterprise/migrationRunner.test.ts
git commit -m "refactor(api): load migrations from directory"
```

---

## Task 2: Add `admin_sessions` migration

Pure data file — no test cycle, just a commit that introduces the schema. Verified indirectly by Task 4's tests.

**Files:**
- Create: `apps/api/src/db/migrations/0002_admin_sessions.sql`

- [ ] **Step 1: Create the migration file**

Write `apps/api/src/db/migrations/0002_admin_sessions.sql`:

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

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/db/migrations/0002_admin_sessions.sql
git commit -m "feat(api): add admin_sessions migration"
```

---

## Task 3: Repository — `findUserById` (in-memory)

The smallest of the five new methods. Add interface and in-memory implementation; defer Postgres implementation to Task 7.

**Files:**
- Modify: `apps/api/src/repository.ts:124-149` (interface) and `apps/api/src/repository.ts:159-348` (in-memory factory)
- Test: `tests/unit/enterprise/adminSessionRepository.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/enterprise/adminSessionRepository.test.ts`:

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

describe('findUserById', () => {
  it('returns the user when org + id match', async () => {
    const { repository, install } = await setupInstalled()
    const found = await repository.findUserById(install.organization.id, install.owner.id)
    expect(found?.username).toBe('owner')
  })

  it('returns null when the id does not exist in the org', async () => {
    const { repository, install } = await setupInstalled()
    const found = await repository.findUserById(install.organization.id, 'no-such-id')
    expect(found).toBeNull()
  })

  it('returns null when the org does not match', async () => {
    const { repository, install } = await setupInstalled()
    const found = await repository.findUserById('other-org', install.owner.id)
    expect(found).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/enterprise/adminSessionRepository.test.ts`
Expected: FAIL with `repository.findUserById is not a function`.

- [ ] **Step 3: Add interface entry**

In `apps/api/src/repository.ts`, locate the `EnterpriseRepository` interface (currently lines 124-149) and add this line near `findUserByUsername`:

```ts
findUserById: (organizationId: string, userId: string) => Promise<EnterpriseUserRecord | null>
```

- [ ] **Step 4: Add in-memory implementation**

In the same file, inside the object returned by `createInMemoryEnterpriseRepository`, add this method near `findUserByUsername`:

```ts
async findUserById(organizationId, userId) {
  return users.find(user => user.organizationId === organizationId && user.id === userId) ?? null
},
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/enterprise/adminSessionRepository.test.ts`
Expected: PASS (3 tests in `findUserById` describe block).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/repository.ts tests/unit/enterprise/adminSessionRepository.test.ts
git commit -m "feat(api): add findUserById to repository"
```

---

## Task 4: Repository — `createAdminSession` + `findAdminSessionByTokenHash` (in-memory)

These two go together — write and read in one TDD cycle. Tests live in the file created in Task 3.

**Files:**
- Modify: `apps/api/src/repository.ts` (interface + in-memory impl)
- Test: `tests/unit/enterprise/adminSessionRepository.test.ts` (extend)

- [ ] **Step 1: Append failing tests**

Append to `tests/unit/enterprise/adminSessionRepository.test.ts`:

```ts
describe('admin session create + lookup', () => {
  it('stores a new session and lets it be found by access-token hash', async () => {
    const { repository, install } = await setupInstalled()

    const created = await repository.createAdminSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      accessTokenHash: 'access-hash-1',
      refreshTokenHash: 'refresh-hash-1',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })

    expect(created.id).toBeTruthy()
    expect(created.revokedAt).toBeNull()
    expect(created.createdAt).toBeTruthy()
    expect(created.lastSeenAt).toBeTruthy()

    const found = await repository.findAdminSessionByTokenHash('access-hash-1')
    expect(found?.id).toBe(created.id)
    expect(found?.userId).toBe(install.owner.id)
  })

  it('returns null for an unknown access-token hash', async () => {
    const { repository } = await setupInstalled()
    const found = await repository.findAdminSessionByTokenHash('no-such-hash')
    expect(found).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/enterprise/adminSessionRepository.test.ts`
Expected: FAIL — `createAdminSession is not a function`.

- [ ] **Step 3: Add types and interface entries**

In `apps/api/src/repository.ts`, near the existing `CreateDeviceSessionInput`, add:

```ts
export interface CreateAdminSessionInput {
  organizationId: string
  userId: string
  accessTokenHash: string
  refreshTokenHash: string
  expiresAt: string
}

export interface AdminSessionRecord {
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
```

In the `EnterpriseRepository` interface, add:

```ts
createAdminSession: (input: CreateAdminSessionInput) => Promise<AdminSessionRecord>
findAdminSessionByTokenHash: (accessTokenHash: string) => Promise<AdminSessionRecord | null>
adminSessions: AdminSessionRecord[]
```

- [ ] **Step 4: Implement in-memory storage**

Inside `createInMemoryEnterpriseRepository`, near `const deviceSessions: DeviceSessionRecord[] = []`, add:

```ts
const adminSessions: AdminSessionRecord[] = []
```

Add `adminSessions` to the returned object's properties (next to `deviceSessions`), and add these methods:

```ts
async createAdminSession(input) {
  const nowTimestamp = nowIso()
  const session: AdminSessionRecord = {
    id: randomUUID(),
    organizationId: input.organizationId,
    userId: input.userId,
    accessTokenHash: input.accessTokenHash,
    refreshTokenHash: input.refreshTokenHash,
    expiresAt: input.expiresAt,
    revokedAt: null,
    createdAt: nowTimestamp,
    lastSeenAt: nowTimestamp,
  }
  adminSessions.push(session)
  return session
},

async findAdminSessionByTokenHash(accessTokenHash) {
  return adminSessions.find(session => session.accessTokenHash === accessTokenHash) ?? null
},
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/enterprise/adminSessionRepository.test.ts`
Expected: PASS (all 5 tests so far).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/repository.ts tests/unit/enterprise/adminSessionRepository.test.ts
git commit -m "feat(api): persist admin sessions in repository"
```

---

## Task 5: Repository — `touchAdminSession` + `revokeAdminSession` (in-memory)

Both are trivial mutations on existing records.

**Files:**
- Modify: `apps/api/src/repository.ts`
- Test: `tests/unit/enterprise/adminSessionRepository.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `tests/unit/enterprise/adminSessionRepository.test.ts`:

```ts
describe('touchAdminSession + revokeAdminSession', () => {
  it('updates lastSeenAt when touched', async () => {
    const { repository, install } = await setupInstalled()
    const created = await repository.createAdminSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      accessTokenHash: 'touch-access',
      refreshTokenHash: 'touch-refresh',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })

    const originalLastSeenAt = created.lastSeenAt
    await new Promise(resolve => setTimeout(resolve, 5))
    await repository.touchAdminSession(created.id)

    const after = await repository.findAdminSessionByTokenHash('touch-access')
    expect(after?.lastSeenAt).not.toBe(originalLastSeenAt)
  })

  it('sets revokedAt when revoked, and is idempotent', async () => {
    const { repository, install } = await setupInstalled()
    const created = await repository.createAdminSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      accessTokenHash: 'revoke-access',
      refreshTokenHash: 'revoke-refresh',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })

    await repository.revokeAdminSession(created.id)
    const afterFirstRevoke = await repository.findAdminSessionByTokenHash('revoke-access')
    expect(afterFirstRevoke?.revokedAt).toBeTruthy()

    await repository.revokeAdminSession(created.id)
    await repository.revokeAdminSession('unknown-id')
    // no throw, no change to other sessions
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/enterprise/adminSessionRepository.test.ts`
Expected: FAIL — `touchAdminSession is not a function`.

- [ ] **Step 3: Add interface entries**

In `apps/api/src/repository.ts` inside `EnterpriseRepository`, add:

```ts
touchAdminSession: (id: string) => Promise<void>
revokeAdminSession: (id: string) => Promise<void>
```

- [ ] **Step 4: Implement in-memory**

Inside `createInMemoryEnterpriseRepository`, add:

```ts
async touchAdminSession(id) {
  const session = adminSessions.find(item => item.id === id)
  if (session)
    session.lastSeenAt = nowIso()
},

async revokeAdminSession(id) {
  const session = adminSessions.find(item => item.id === id)
  if (session && !session.revokedAt)
    session.revokedAt = nowIso()
},
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/enterprise/adminSessionRepository.test.ts`
Expected: PASS (all 7 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/repository.ts tests/unit/enterprise/adminSessionRepository.test.ts
git commit -m "feat(api): support touch + revoke for admin sessions"
```

---

## Task 6: Repository — Postgres implementations of all 5 new methods

No new tests here — Postgres testing is not part of the existing repo's setup. Strictly add the implementations, mirroring patterns already used in `postgresRepository.ts`.

**Files:**
- Modify: `apps/api/src/db/postgresRepository.ts`

- [ ] **Step 1: Add a row mapper at the top of the file**

Near the existing row-mapper helpers (around line 38-96), add:

```ts
function adminSessionFromRow(row: Record<string, unknown>): AdminSessionRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    userId: String(row.user_id),
    accessTokenHash: String(row.access_token_hash),
    refreshTokenHash: String(row.refresh_token_hash),
    expiresAt: iso(row.expires_at as string | Date),
    revokedAt: row.revoked_at ? iso(row.revoked_at as string | Date) : null,
    createdAt: iso(row.created_at as string | Date),
    lastSeenAt: iso(row.last_seen_at as string | Date),
  }
}
```

Also update the imports near the top:

```ts
import type {
  AdminSessionRecord,
  AppendAuditLogInput,
  AuthorizationCodeRecord,
  CreateAdminSessionInput,
  CreateAuthorizationCodeInput,
  CreateDeviceSessionInput,
  CreateOrganizationInput,
  CreateUserInput,
  EnterpriseRepository,
  EnterpriseUserRecord,
  MatrixAccountRecord,
  ResetUserPasswordInput,
  UpdateUserInput,
} from '../repository'
```

- [ ] **Step 2: Add `adminSessions: []` to the returned object**

In `createPostgresEnterpriseRepository`, alongside `auditLogs: []`, `deviceSessions: []`, etc., add:

```ts
adminSessions: [],
```

(The arrays in the Postgres impl are unused but present to satisfy the interface — same pattern as existing fields.)

- [ ] **Step 3: Implement the 5 methods**

Inside the returned object of `createPostgresEnterpriseRepository`, add:

```ts
async findUserById(organizationId: string, userId: string) {
  const result = await pool.query(
    'SELECT * FROM users WHERE organization_id = $1 AND id = $2',
    [organizationId, userId],
  )
  return result.rows[0] ? userFromRow(result.rows[0]) : null
},

async createAdminSession(input: CreateAdminSessionInput) {
  const createdAt = nowIso()
  const result = await pool.query(
    `INSERT INTO admin_sessions
       (id, organization_id, user_id, access_token_hash, refresh_token_hash, expires_at, revoked_at, created_at, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $7)
     RETURNING *`,
    [
      randomUUID(),
      input.organizationId,
      input.userId,
      input.accessTokenHash,
      input.refreshTokenHash,
      input.expiresAt,
      createdAt,
    ],
  )
  return adminSessionFromRow(result.rows[0])
},

async findAdminSessionByTokenHash(accessTokenHash: string) {
  const result = await pool.query(
    'SELECT * FROM admin_sessions WHERE access_token_hash = $1',
    [accessTokenHash],
  )
  return result.rows[0] ? adminSessionFromRow(result.rows[0]) : null
},

async touchAdminSession(id: string) {
  await pool.query(
    'UPDATE admin_sessions SET last_seen_at = $2 WHERE id = $1',
    [id, nowIso()],
  )
},

async revokeAdminSession(id: string) {
  await pool.query(
    'UPDATE admin_sessions SET revoked_at = COALESCE(revoked_at, $2) WHERE id = $1',
    [id, nowIso()],
  )
},
```

- [ ] **Step 4: Run type-check to confirm no TS errors**

Run: `pnpm --filter @muon/api build`
Expected: `tsc --noEmit` passes (exit 0).

- [ ] **Step 5: Run the full enterprise test suite**

Run: `pnpm test:enterprise`
Expected: PASS — no regressions (Postgres impl isn't exercised but TypeScript checks both impls satisfy the interface).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/db/postgresRepository.ts
git commit -m "feat(api): implement admin session methods on postgres"
```

---

## Task 7: `AdminAuthenticationError` class

Distinct error type so `errorResponse` can map it to 401 without regex-matching messages.

**Files:**
- Modify: `apps/api/src/modules/auth/adminSessionService.ts`

- [ ] **Step 1: Add export**

At the top of `apps/api/src/modules/auth/adminSessionService.ts`, after the imports, add:

```ts
export class AdminAuthenticationError extends Error {
  constructor(message = 'Admin authentication required') {
    super(message)
    this.name = 'AdminAuthenticationError'
  }
}
```

- [ ] **Step 2: Run type-check**

Run: `pnpm --filter @muon/api build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/auth/adminSessionService.ts
git commit -m "feat(api): add AdminAuthenticationError class"
```

---

## Task 8: `adminSessionService.login` persists the session

Modify `login` so the returned tokens are also written to `admin_sessions`, hashed.

**Files:**
- Modify: `apps/api/src/modules/auth/adminSessionService.ts`
- Test: `tests/unit/enterprise/adminSessionService.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/enterprise/adminSessionService.test.ts`:

```ts
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createAdminSessionService } from '../../../apps/api/src/modules/auth/adminSessionService'
import { createInstallService } from '../../../apps/api/src/modules/install/installService'
import { createInMemoryEnterpriseRepository } from '../../../apps/api/src/repository'

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

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

describe('adminSessionService.login persistence', () => {
  it('writes a session whose access_token_hash matches the returned token', async () => {
    const { repository } = await setupOwner()
    const service = createAdminSessionService({ repository })

    const result = await service.login({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
    })

    const found = await repository.findAdminSessionByTokenHash(sha256(result.session.accessToken))
    expect(found).not.toBeNull()
    expect(found?.userId).toBe(result.user.id)
    expect(found?.revokedAt).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/enterprise/adminSessionService.test.ts`
Expected: FAIL — `found` is null.

- [ ] **Step 3: Modify `login` to persist**

In `apps/api/src/modules/auth/adminSessionService.ts`, add to the imports:

```ts
import { createHash, randomBytes } from 'node:crypto'
```

(Replace the existing `import { randomBytes } from 'node:crypto'` line.)

Then add this helper above `createAdminSessionService`:

```ts
function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
```

Modify the `login` function. Replace the existing `return { user, session: { ... } }` block at the bottom of `login` with:

```ts
const accessToken = createToken()
const refreshToken = createToken()
const expiresAt = sessionExpiry()
await repository.createAdminSession({
  organizationId: organization.id,
  userId: user.id,
  accessTokenHash: sha256(accessToken),
  refreshTokenHash: sha256(refreshToken),
  expiresAt,
})

return {
  user,
  session: { accessToken, refreshToken, expiresAt },
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/enterprise/adminSessionService.test.ts tests/unit/enterprise/apiRoutes.test.ts tests/unit/enterprise/adminUsers.test.ts`
Expected: all PASS. Existing route and admin-user tests must keep working because they call `login` for tokens — those tokens are now also persisted, which is a strict superset of the old behavior.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/adminSessionService.ts tests/unit/enterprise/adminSessionService.test.ts
git commit -m "feat(api): persist admin sessions on login"
```

---

## Task 9: `adminSessionService.validate`

Add the validate method that consumers (routes) will use.

**Files:**
- Modify: `apps/api/src/modules/auth/adminSessionService.ts`
- Test: `tests/unit/enterprise/adminSessionService.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `tests/unit/enterprise/adminSessionService.test.ts`:

```ts
describe('adminSessionService.validate', () => {
  it('returns the user for a freshly issued token', async () => {
    const { repository } = await setupOwner()
    const service = createAdminSessionService({ repository })
    const { session } = await service.login({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
    })

    const user = await service.validate(session.accessToken)
    expect(user.username).toBe('owner')
  })

  it('throws AdminAuthenticationError for an unknown token', async () => {
    const { repository } = await setupOwner()
    const service = createAdminSessionService({ repository })
    await expect(service.validate('not-a-real-token')).rejects.toMatchObject({
      name: 'AdminAuthenticationError',
    })
  })

  it('throws when the session has been revoked', async () => {
    const { repository } = await setupOwner()
    const service = createAdminSessionService({ repository })
    const { session } = await service.login({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
    })

    const stored = await repository.findAdminSessionByTokenHash(sha256(session.accessToken))
    if (!stored) throw new Error('precondition: session missing')
    await repository.revokeAdminSession(stored.id)

    await expect(service.validate(session.accessToken)).rejects.toMatchObject({
      name: 'AdminAuthenticationError',
    })
  })

  it('throws when the session has expired', async () => {
    const { repository } = await setupOwner()
    const service = createAdminSessionService({ repository })
    const { session } = await service.login({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
    })

    const stored = await repository.findAdminSessionByTokenHash(sha256(session.accessToken))
    if (!stored) throw new Error('precondition: session missing')
    stored.expiresAt = new Date(Date.now() - 1000).toISOString()

    await expect(service.validate(session.accessToken)).rejects.toMatchObject({
      name: 'AdminAuthenticationError',
    })
  })

  it('throws when the user has been disabled', async () => {
    const { repository, install } = await setupOwner()
    const service = createAdminSessionService({ repository })
    const { session } = await service.login({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
    })

    await repository.updateUser(install.organization.id, install.owner.id, { status: 'disabled' })

    await expect(service.validate(session.accessToken)).rejects.toMatchObject({
      name: 'AdminAuthenticationError',
    })
  })

  it('updates lastSeenAt on success', async () => {
    const { repository } = await setupOwner()
    const service = createAdminSessionService({ repository })
    const { session } = await service.login({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
    })

    const before = await repository.findAdminSessionByTokenHash(sha256(session.accessToken))
    if (!before) throw new Error('precondition: session missing')
    const originalLastSeenAt = before.lastSeenAt
    await new Promise(resolve => setTimeout(resolve, 5))
    await service.validate(session.accessToken)
    const after = await repository.findAdminSessionByTokenHash(sha256(session.accessToken))
    expect(after?.lastSeenAt).not.toBe(originalLastSeenAt)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/enterprise/adminSessionService.test.ts`
Expected: FAIL — `service.validate is not a function`.

- [ ] **Step 3: Add `validate` to the service**

In `apps/api/src/modules/auth/adminSessionService.ts`, extend the `AdminSessionService` interface:

```ts
export interface AdminSessionService {
  login: (input: AdminLoginRequest) => Promise<AdminSession>
  validate: (token: string) => Promise<EnterpriseUserRecord>
  revoke: (token: string) => Promise<void>
}
```

Inside the object returned by `createAdminSessionService`, add:

```ts
async validate(token) {
  if (!token)
    throw new AdminAuthenticationError()

  const session = await repository.findAdminSessionByTokenHash(sha256(token))
  if (!session || session.revokedAt)
    throw new AdminAuthenticationError()

  if (new Date(session.expiresAt).getTime() <= Date.now())
    throw new AdminAuthenticationError()

  const user = await repository.findUserById(session.organizationId, session.userId)
  if (!user || user.status !== 'active')
    throw new AdminAuthenticationError()

  repository.touchAdminSession(session.id).catch(() => {})
  return user
},

async revoke(_token) {
  // implemented in Task 10
  throw new Error('revoke not implemented')
},
```

The `revoke` body is a temporary stub; Task 10 replaces it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/enterprise/adminSessionService.test.ts`
Expected: PASS (all 7 tests so far).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/adminSessionService.ts tests/unit/enterprise/adminSessionService.test.ts
git commit -m "feat(api): validate admin sessions via service"
```

---

## Task 10: `adminSessionService.revoke`

Replace the stub from Task 9.

**Files:**
- Modify: `apps/api/src/modules/auth/adminSessionService.ts`
- Test: `tests/unit/enterprise/adminSessionService.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `tests/unit/enterprise/adminSessionService.test.ts`:

```ts
describe('adminSessionService.revoke', () => {
  it('makes a previously valid token fail validate', async () => {
    const { repository } = await setupOwner()
    const service = createAdminSessionService({ repository })
    const { session } = await service.login({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
    })

    await service.revoke(session.accessToken)

    await expect(service.validate(session.accessToken)).rejects.toMatchObject({
      name: 'AdminAuthenticationError',
    })
  })

  it('is a silent no-op for an unknown token', async () => {
    const { repository } = await setupOwner()
    const service = createAdminSessionService({ repository })
    await expect(service.revoke('unknown-token')).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/enterprise/adminSessionService.test.ts`
Expected: FAIL — the revoke stub still throws.

- [ ] **Step 3: Replace the stub**

In `apps/api/src/modules/auth/adminSessionService.ts`, replace the `revoke` method with:

```ts
async revoke(token) {
  if (!token)
    return
  const session = await repository.findAdminSessionByTokenHash(sha256(token))
  if (!session)
    return
  await repository.revokeAdminSession(session.id)
},
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/enterprise/adminSessionService.test.ts`
Expected: PASS (all 9 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/adminSessionService.ts tests/unit/enterprise/adminSessionService.test.ts
git commit -m "feat(api): support revoke in admin session service"
```

---

## Task 11: `errorResponse` maps `AdminAuthenticationError` → 401

So routes that throw the error get the right status without changing the message-regex logic for other errors.

**Files:**
- Modify: `apps/api/src/routes.ts`

- [ ] **Step 1: Update `errorResponse`**

In `apps/api/src/routes.ts`, add to the imports:

```ts
import { AdminAuthenticationError, createAdminSessionService } from './modules/auth/adminSessionService'
```

(Replace the existing `createAdminSessionService` import line.)

Replace the existing `errorResponse` function:

```ts
function errorResponse(error: unknown): Response {
  if (error instanceof AdminAuthenticationError)
    return jsonResponse({ error: error.message }, { status: 401 })

  const message = error instanceof Error ? error.message : 'Unexpected error'
  const status = /credentials|not found|invalid/i.test(message) ? 400 : 409
  return jsonResponse({ error: message }, { status })
}
```

- [ ] **Step 2: Run existing route tests to confirm nothing else regressed**

Run: `pnpm vitest run tests/unit/enterprise/apiRoutes.test.ts`
Expected: PASS (4 existing tests, unchanged — 401 path is not yet exercised).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes.ts
git commit -m "feat(api): map AdminAuthenticationError to HTTP 401"
```

---

## Task 12: Routes use `adminSessionService.validate`

The actual replacement of the in-memory `adminTokens` Map. After this task, an API restart no longer logs admins out.

**Files:**
- Modify: `apps/api/src/routes.ts`
- Test: `tests/unit/enterprise/apiRoutes.test.ts`

- [ ] **Step 1: Add failing tests for the 401 paths**

Append to `tests/unit/enterprise/apiRoutes.test.ts`, inside the existing `describe('enterprise api routes', () => { ... })`:

```ts
it('rejects admin requests with no bearer token as 401', async () => {
  const handler = createEnterpriseHttpHandler()
  const response = await handler.fetch(new Request('http://muon.test/api/admin/organizations'))
  expect(response.status).toBe(401)
})

it('rejects admin requests with an unknown bearer token as 401', async () => {
  const handler = createEnterpriseHttpHandler()
  const response = await handler.fetch(new Request('http://muon.test/api/admin/organizations', {
    headers: { authorization: 'Bearer bogus-token' },
  }))
  expect(response.status).toBe(401)
})

it('keeps admin sessions valid across handler recreation when sharing a repository', async () => {
  const repository = createInMemoryEnterpriseRepository()
  const handlerA = createEnterpriseHttpHandler({ repository })

  await handlerA.fetch(new Request('http://muon.test/api/install', {
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

  const login = await handlerA.fetch(new Request('http://muon.test/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
    }),
  }))
  const loginPayload = await login.json() as { session: { accessToken: string } }

  // Simulate a restart: same repository (= same DB), brand new HTTP handler instance.
  const handlerB = createEnterpriseHttpHandler({ repository })
  const me = await handlerB.fetch(new Request('http://muon.test/api/admin/me', {
    headers: { authorization: `Bearer ${loginPayload.session.accessToken}` },
  }))
  expect(me.status).toBe(200)
})
```

At the top of the file, add to the imports:

```ts
import { createInMemoryEnterpriseRepository } from '../../../apps/api/src/repository'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/enterprise/apiRoutes.test.ts`
Expected: FAIL — currently admin endpoints with no/bad token throw, but `errorResponse` falls into the 409 branch; the restart test fails because the new handler has an empty Map.

- [ ] **Step 3: Replace `adminTokens` Map and rewire `requireAdmin`**

In `apps/api/src/routes.ts`:

1. Inside `createEnterpriseHttpHandler`, delete this line:

   ```ts
   const adminTokens = new Map<string, EnterpriseUserRecord>()
   ```

2. Replace the `requireAdmin` function with:

   ```ts
   async function requireAdmin(request: Request): Promise<EnterpriseUserRecord> {
     const token = bearerToken(request)
     if (!token)
       throw new AdminAuthenticationError()
     return adminSessionService.validate(token)
   }
   ```

   The existing `EnterpriseUserRecord` type import stays — it remains the return type of `requireAdmin`.

3. In the `/api/admin/login` handler, delete this line:

   ```ts
   adminTokens.set(result.session.accessToken, result.user)
   ```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/enterprise/apiRoutes.test.ts`
Expected: PASS (4 existing + 3 new tests).

- [ ] **Step 5: Run the whole enterprise suite**

Run: `pnpm test:enterprise`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes.ts tests/unit/enterprise/apiRoutes.test.ts
git commit -m "feat(api): validate admin sessions through service instead of in-memory map"
```

---

## Task 13: Frontend `getAdminMe`

Add the API client function.

**Files:**
- Modify: `apps/admin/src/api.ts`

- [ ] **Step 1: Append the function**

Append to `apps/admin/src/api.ts`:

```ts
export function getAdminMe(token: string): Promise<{ user: EnterpriseUser }> {
  return request('/api/admin/me', {
    headers: {
      authorization: `Bearer ${token}`,
    },
  })
}
```

(`EnterpriseUser` is already imported at the top.)

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @muon/admin build`
Expected: build succeeds (no test exists yet — frontend test runs after Task 14).

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/api.ts
git commit -m "feat(admin): add getAdminMe client"
```

---

## Task 14: Frontend bootstrap — validate stored token before showing dashboard

The behavior change in `AdminApp.vue` plus the corresponding tests.

**Files:**
- Modify: `apps/admin/src/AdminApp.vue`
- Test: `tests/components/AdminApp.test.ts`

- [ ] **Step 1: Add `getAdminMe` to the test mock**

In `tests/components/AdminApp.test.ts`, find the `vi.mock('../../apps/admin/src/api', () => ({ ... }))` block at the top of the file. Inside it, add:

```ts
getAdminMe: vi.fn(async () => ({
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

Also import it where the other mocked functions are imported (top of the file):

```ts
import {
  createAdminUser,
  createOrganization,
  getAdminMe,
  listAuditLogs,
  listOrganizations,
  listUsers,
  loginAdmin,
  resetAdminUserPassword,
  updateAdminUser,
} from '../../apps/admin/src/api'
```

- [ ] **Step 2: Add failing tests**

Inside `describe('adminApp', ...)`, append:

```ts
it('validates a stored admin token on mount before showing the dashboard', async () => {
  window.localStorage.setItem('muon_admin_token', 'stored-token')
  const wrapper = mount(AdminApp, {
    props: { initialInstalled: true },
    global: {
      plugins: [createAdminRouter(createMemoryHistory())],
    },
  })
  await flushPromises()

  expect(getAdminMe).toHaveBeenCalledWith('stored-token')
  expect(listOrganizations).toHaveBeenCalled()
  expect(wrapper.find('[data-testid="organizations-panel"]').exists()).toBe(true)
})

it('clears the stored token and falls back to the login form when getAdminMe rejects with auth error', async () => {
  window.localStorage.setItem('muon_admin_token', 'stale-token')
  ;(getAdminMe as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Admin authentication required'))

  const wrapper = mount(AdminApp, {
    props: { initialInstalled: true },
    global: {
      plugins: [createAdminRouter(createMemoryHistory())],
    },
  })
  await flushPromises()

  expect(window.localStorage.getItem('muon_admin_token')).toBe(null)
  expect(wrapper.find('input[autocomplete="organization"]').exists()).toBe(true)
  expect(listOrganizations).not.toHaveBeenCalled()
})
```

Add to the top imports if not already present:

```ts
import { flushPromises } from '@vue/test-utils'
```

Also ensure each test starts clean by adding (or extending) a `beforeEach`:

```ts
beforeEach(() => {
  window.localStorage.clear()
  vi.clearAllMocks()
})
```

(`beforeEach` is already imported at the top of the file. If it already exists, merge the body — don't add a duplicate.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run tests/components/AdminApp.test.ts`
Expected: FAIL — `getAdminMe` not invoked (the component currently calls `refreshDashboard` directly).

- [ ] **Step 4: Replace the on-mount path in `AdminApp.vue`**

In `apps/admin/src/AdminApp.vue`:

1. Update the import line to include `getAdminMe`:

   ```ts
   import { createAdminUser, createOrganization, getAdminMe, listAuditLogs, listOrganizations, listUsers, loginAdmin, resetAdminUserPassword, updateAdminUser } from './api'
   ```

2. Replace the existing trailing call at the bottom of `<script setup>`:

   ```ts
   if (adminToken.value)
     void refreshDashboard()
   ```

   with:

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

   void bootstrap()
   ```

   `isAuthenticationError` already matches `/authentication|credentials|required/i`, so the 401 body `{"error":"Admin authentication required"}` will trip it via the `required` keyword.

- [ ] **Step 5: Run frontend tests**

Run: `pnpm vitest run tests/components/AdminApp.test.ts`
Expected: PASS — all existing AdminApp tests + 2 new bootstrap tests.

- [ ] **Step 6: Run the full enterprise suite as final regression check**

Run: `pnpm test:enterprise`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/AdminApp.vue tests/components/AdminApp.test.ts
git commit -m "feat(admin): validate stored token on bootstrap via GET /api/admin/me"
```

---

## Final verification

- [ ] **Step 1: Run the entire enterprise test suite**

Run: `pnpm test:enterprise`
Expected: ALL PASS.

- [ ] **Step 2: Run a top-level type-check**

Run: `pnpm type-check`
Expected: exit 0.

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: exit 0.

If lint complains about unused imports left over from the deleted `adminTokens` Map, fix them and re-run.

- [ ] **Step 4: Manual smoke test (optional but recommended)**

In two terminals:

```bash
# Terminal 1
pnpm services:up
pnpm dev:api

# Terminal 2
pnpm dev:admin
```

In the admin UI: install, log in. Stop and restart `pnpm dev:api`. Refresh the admin page. You should remain logged in (the previous behavior would have kicked you back to the login form).
