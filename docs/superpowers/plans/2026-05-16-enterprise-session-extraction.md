# EnterpriseSession Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `src/matrix/auth.ts` (447 lines, three concerns mixed) into three deep modules — **MatrixSession** (slim Matrix-only auth), **EnterpriseSession** (PKCE + Muon API + persistence), and **lifecycle** (orchestrator) — and promote `deviceName` to a contract field returned by the Muon API.

**Architecture:**
- `packages/enterprise-contracts` gains `deviceName` in `muonSessionSchema`; server emits it on every token issuance and refresh. Desktop never persists it standalone — it always rides on the returned `MuonSession`.
- `src/matrix/auth.ts` slims down to MatrixSession operations only. `src/enterprise/session.ts` (new) owns Muon's PKCE, exchange, refresh, restore, clear — all dependencies (`http`, `storage`, `clock`, `openUrl`, `apiBaseUrl`, `refreshThresholdMs`) injected so tests use no Electron or matrix-js-sdk references.
- `src/auth/lifecycle.ts` (new) is the single public surface — `bootstrap`, `signInWithPassword`, `signInWithEnterprise`, `signOut` — owning the correct order (stopSync → matrix.logout → unbindEvents → destroy → clear) so callers do not.

**Tech Stack:** TypeScript, Vue 3, Electron (`safeStorage`), Vitest (jsdom), Zod schemas, matrix-js-sdk, Pinia (not added — orchestrator is plain module). Server side: Fastify-style routes + in-memory and Postgres repository adapters.

**Glossary (see `CONTEXT.md`):** **MatrixSession**, **MuonSession**, **DeviceSession**, **EnterpriseSession**, **PkceTransientState**, **SignIn**, **SignOut**, **Bootstrap**.

**Locked design decisions:**
- Q1 names: `EnterpriseSession` (desktop) / `DeviceSession` (server) for the same row.
- Q2-B: `EnterpriseSession` and `MatrixSession` are sibling modules; lifecycle coordinates.
- Q3: deep desktop module, no `packages/enterprise-client` extraction.
- Q4-A + Q8-C: `deviceName` is a required field on `muonSessionSchema`; desktop stops persisting it standalone.
- Q5: `restore()` auto-refreshes if near expiry; threshold injected.
- Q6: deps injection; tests touch zero global mocks of Electron / matrix-js-sdk.
- Q7-B: orchestrator is `src/auth/lifecycle.ts`.
- PKCE: transient `PkceTransientState` is private to `src/enterprise/session.ts`, used only between `start` and `complete`.
- On `refresh` 401 (server says session is gone): clear stored EnterpriseSession.

**Storage ownership invariant (important):**
- `MatrixSession` module exclusively owns `localStorage` key `muon_auth`.
- `EnterpriseSession` module exclusively owns `localStorage` keys `muon_enterprise_session` (Muon tokens) and `muon_enterprise_pkce` (transient PKCE).
- `EnterpriseSession` never reads or writes the Matrix storage key directly. When it needs the current Matrix session (e.g., to assemble `{ muon, matrix }` from `restore`), it calls a `readMatrixSession` callback supplied through deps.
- On sign-in, the freshly-issued **MatrixSession** comes from the server's token response and is activated/persisted via `activateMatrixSession` (the MatrixSession module's job), not via EnterpriseSession.

---

## File Map

### Create
- `src/shared/safeStorageStore.ts` — generic `{ read, write, clear }` over `localStorage` with optional `safeStorage` encryption and Zod validation.
- `src/enterprise/session.ts` — `EnterpriseSession` module: `start`, `complete`, `refresh`, `restore`, `clear`, plus internal PKCE helpers.
- `src/enterprise/index.ts` — public re-exports.
- `src/auth/lifecycle.ts` — orchestrator: `bootstrap`, `signInWithPassword`, `signInWithEnterprise`, `signOut`.
- `tests/unit/shared/safeStorageStore.test.ts`
- `tests/unit/enterprise/session.test.ts`
- `tests/unit/auth/lifecycle.test.ts`

### Modify
- `packages/enterprise-contracts/src/schemas.ts:117-122` — add `deviceName` to `muonSessionSchema`.
- `apps/api/src/modules/oauth/oauthService.ts:148-198, 200-255` — emit `deviceName` in both `exchangeCode` and `refresh` responses.
- `tests/unit/enterprise/contracts.test.ts` — update if it asserts shape.
- `tests/unit/enterprise/oauthRefresh.test.ts` — assert `deviceName` round-trip.
- `tests/unit/enterprise/oauthDesktopFlow.test.ts` — assert `deviceName` on issuance.
- `src/matrix/auth.ts` — slim to MatrixSession surface only (`loginWithPassword`, `register`, `restoreMatrixSession`, `activateMatrixSession`, `logoutMatrix`, types).
- `src/matrix/index.ts:1` — update re-exports.
- `src/app/App.vue:31-44` — use `lifecycle.bootstrap`.
- `src/features/auth/components/LoginPage.vue:132-160` — use `lifecycle.signInWithEnterprise` and `signInWithPassword`.
- `tests/unit/matrix/auth.test.ts` — keep MatrixSession assertions; remove enterprise-flow assertions (moved to `tests/unit/enterprise/session.test.ts`).

### Verify (no changes expected)
- `apps/api/src/repository.ts:72-82` — `DeviceSessionRecord.deviceName` already exists.
- `apps/api/src/db/postgresRepository.ts:227-303` — `createDeviceSession` already persists `deviceName`.

---

## Pre-flight

- [ ] **Step P1: Sanity-check baseline tests pass**

Run: `pnpm test:unit --run`
Expected: All tests pass. Note the count for later comparison.

If any test is failing before we start, stop and report. The plan assumes a clean baseline.

---

## Phase 1: Contract — `deviceName` on `muonSessionSchema`

### Task 1: Add `deviceName` field to `muonSessionSchema`

**Files:**
- Modify: `packages/enterprise-contracts/src/schemas.ts:117-122`
- Test: `packages/enterprise-contracts/tests/contracts.test.ts` (if exists) OR `tests/unit/enterprise/contracts.test.ts`

- [ ] **Step 1.1: Write a failing test for the new shape**

Open `tests/unit/enterprise/contracts.test.ts`. Add at the bottom (inside the existing `describe` block, or create a new `describe('muonSessionSchema')`):

```ts
import { muonSessionSchema } from '@muon/enterprise-contracts'

describe('muonSessionSchema', () => {
  it('requires deviceName', () => {
    const result = muonSessionSchema.safeParse({
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: '2030-01-01T00:00:00.000Z',
    })
    expect(result.success).toBe(false)
  })

  it('accepts a session with deviceName', () => {
    const result = muonSessionSchema.safeParse({
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: '2030-01-01T00:00:00.000Z',
      deviceName: 'Muon Desktop',
    })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `pnpm test:unit --run tests/unit/enterprise/contracts.test.ts`
Expected: First test (`requires deviceName`) fails — current schema accepts the object without `deviceName`. Second test passes (extra field accepted by zod by default but we'll make it required).

- [ ] **Step 1.3: Add `deviceName` to the schema**

In `packages/enterprise-contracts/src/schemas.ts`, replace lines 117–122:

```ts
export const muonSessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.string().datetime(),
  deviceName: z.string().trim().min(1),
})
export type MuonSession = z.infer<typeof muonSessionSchema>
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `pnpm test:unit --run tests/unit/enterprise/contracts.test.ts`
Expected: Both tests pass.

- [ ] **Step 1.5: Run full unit suite — expect API tests to fail**

Run: `pnpm test:unit --run`
Expected: `tests/unit/enterprise/oauthDesktopFlow.test.ts` and `tests/unit/enterprise/oauthRefresh.test.ts` fail because the server still returns `muonSession` without `deviceName`. **This is expected** — Task 2 will fix it. Note which tests fail so we can re-check them later.

- [ ] **Step 1.6: Commit**

```bash
git add packages/enterprise-contracts/src/schemas.ts tests/unit/enterprise/contracts.test.ts
git commit -m "feat(contracts): require deviceName on muonSessionSchema"
```

---

### Task 2: Server emits `deviceName` in `exchangeCode` response

**Files:**
- Modify: `apps/api/src/modules/oauth/oauthService.ts:148-198`
- Test: `tests/unit/enterprise/oauthDesktopFlow.test.ts`

- [ ] **Step 2.1: Update the `oauthDesktopFlow` test to assert `deviceName` is returned**

Find the existing test that calls `exchangeCode` and asserts on `muonSession`. Add an assertion that `tokenResponse.muonSession.deviceName === request.deviceName` (use the same `deviceName` the test passes into `loginAndCreateCode`'s downstream chain or the test's `exchangeCode` input — read the file first to identify the input value, e.g., `'Test Device'`).

```ts
// Example — adapt to the actual test variable names
const tokenResponse = await service.exchangeCode({ /* ...existing args, deviceName: 'Test Device' */ })
expect(tokenResponse.muonSession.deviceName).toBe('Test Device')
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `pnpm test:unit --run tests/unit/enterprise/oauthDesktopFlow.test.ts`
Expected: Fail — `deviceName` is `undefined` in the returned `muonSession`.

- [ ] **Step 2.3: Make `exchangeCode` emit `deviceName`**

In `apps/api/src/modules/oauth/oauthService.ts`, find the `return` block inside `exchangeCode` (around line 190–198). Change:

```ts
return {
  muonSession: {
    accessToken,
    refreshToken,
    expiresAt,
  },
  matrixSession: authorizationCode.matrixSession,
}
```

To:

```ts
return {
  muonSession: {
    accessToken,
    refreshToken,
    expiresAt,
    deviceName: request.deviceName,
  },
  matrixSession: authorizationCode.matrixSession,
}
```

- [ ] **Step 2.4: Run test to verify it passes**

Run: `pnpm test:unit --run tests/unit/enterprise/oauthDesktopFlow.test.ts`
Expected: Pass.

- [ ] **Step 2.5: Commit**

```bash
git add apps/api/src/modules/oauth/oauthService.ts tests/unit/enterprise/oauthDesktopFlow.test.ts
git commit -m "feat(api): return deviceName in exchangeCode muonSession"
```

---

### Task 3: Server emits `deviceName` in `refresh` response

**Files:**
- Modify: `apps/api/src/modules/oauth/oauthService.ts:200-255`
- Test: `tests/unit/enterprise/oauthRefresh.test.ts`

- [ ] **Step 3.1: Update refresh test to assert `deviceName` round-trip**

Find the test in `tests/unit/enterprise/oauthRefresh.test.ts` that asserts on the refresh response. Add:

```ts
// After refresh
expect(refreshed.muonSession.deviceName).toBe(/* the deviceName passed in the refresh request */)
```

If the test passes a custom `deviceName` (e.g., `'My Laptop'`) in the refresh input, assert that. If it uses the default, use that.

- [ ] **Step 3.2: Run test to verify it fails**

Run: `pnpm test:unit --run tests/unit/enterprise/oauthRefresh.test.ts`
Expected: Fail — `deviceName` undefined.

- [ ] **Step 3.3: Make `refresh` emit `deviceName`**

In `apps/api/src/modules/oauth/oauthService.ts`, inside `refresh`, find the `return` block (around line 242–254):

```ts
return {
  muonSession: {
    accessToken,
    refreshToken,
    expiresAt,
  },
  matrixSession: { /* ... */ },
}
```

Change to:

```ts
return {
  muonSession: {
    accessToken,
    refreshToken,
    expiresAt,
    deviceName: request.deviceName,
  },
  matrixSession: { /* ... */ },
}
```

- [ ] **Step 3.4: Run test to verify it passes**

Run: `pnpm test:unit --run tests/unit/enterprise/oauthRefresh.test.ts`
Expected: Pass.

- [ ] **Step 3.5: Run full unit suite**

Run: `pnpm test:unit --run`
Expected: All API-side tests now pass. Desktop tests (`tests/unit/matrix/auth.test.ts`) may still fail because the existing desktop code calls `oauthTokenResponseSchema.parse(...)` and the server response now includes `deviceName` but the desktop's parsed type doesn't yet recognise it as required (it'll parse fine — extra field — but persist code drops it). **Mark this**: the existing desktop persist logic at `src/matrix/auth.ts:330` does `{ ...tokenResponse.muonSession, deviceName: 'Muon Desktop' }` — the spread now includes server's `deviceName`, but then `deviceName: 'Muon Desktop'` overwrites it. So *behaviour* is unchanged at this point. Phase 4 fixes this.

- [ ] **Step 3.6: Commit**

```bash
git add apps/api/src/modules/oauth/oauthService.ts tests/unit/enterprise/oauthRefresh.test.ts
git commit -m "feat(api): return deviceName in refresh muonSession"
```

---

## Phase 2: Storage helper

### Task 4: Create `safeStorageStore` with tests

**Files:**
- Create: `src/shared/safeStorageStore.ts`
- Test: `tests/unit/shared/safeStorageStore.test.ts`

- [ ] **Step 4.1: Write failing tests for `safeStorageStore`**

Create `tests/unit/shared/safeStorageStore.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { makeEncryptedStore } from '@/shared/safeStorageStore'

const sampleSchema = z.object({ token: z.string() })

interface FakeSafeStorage {
  isAvailable: () => Promise<boolean>
  encrypt: (s: string) => Promise<string>
  decrypt: (s: string) => Promise<string>
}

function makeFakeSafeStorage(available: boolean): FakeSafeStorage {
  return {
    isAvailable: vi.fn().mockResolvedValue(available),
    encrypt: vi.fn(async s => `ENC(${s})`),
    decrypt: vi.fn(async s => s.replace(/^ENC\((.*)\)$/, '$1')),
  }
}

describe('makeEncryptedStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('writes and reads with encryption when available', async () => {
    const safeStorage = makeFakeSafeStorage(true)
    const store = makeEncryptedStore({ key: 'k', schema: sampleSchema, safeStorage })

    await store.write({ token: 'abc' })
    const raw = localStorage.getItem('k')!
    expect(JSON.parse(raw)._enc).toBe(true)

    const read = await store.read()
    expect(read).toEqual({ token: 'abc' })
  })

  it('writes and reads plaintext when safeStorage unavailable', async () => {
    const safeStorage = makeFakeSafeStorage(false)
    const store = makeEncryptedStore({ key: 'k', schema: sampleSchema, safeStorage })

    await store.write({ token: 'abc' })
    const raw = localStorage.getItem('k')!
    expect(JSON.parse(raw)).toEqual({ token: 'abc' })

    const read = await store.read()
    expect(read).toEqual({ token: 'abc' })
  })

  it('returns null on missing key', async () => {
    const store = makeEncryptedStore({ key: 'k', schema: sampleSchema, safeStorage: makeFakeSafeStorage(false) })
    expect(await store.read()).toBeNull()
  })

  it('returns null on schema mismatch', async () => {
    const store = makeEncryptedStore({ key: 'k', schema: sampleSchema, safeStorage: makeFakeSafeStorage(false) })
    localStorage.setItem('k', JSON.stringify({ wrong: 'shape' }))
    expect(await store.read()).toBeNull()
  })

  it('clear removes the key', async () => {
    const store = makeEncryptedStore({ key: 'k', schema: sampleSchema, safeStorage: makeFakeSafeStorage(false) })
    await store.write({ token: 'abc' })
    store.clear()
    expect(localStorage.getItem('k')).toBeNull()
  })

  it('falls back to plaintext when encrypt throws', async () => {
    const safeStorage = makeFakeSafeStorage(true)
    safeStorage.encrypt = vi.fn().mockRejectedValueOnce(new Error('keychain locked'))
    const store = makeEncryptedStore({ key: 'k', schema: sampleSchema, safeStorage })

    await store.write({ token: 'abc' })
    const raw = localStorage.getItem('k')!
    expect(JSON.parse(raw)).toEqual({ token: 'abc' })
  })
})
```

- [ ] **Step 4.2: Run tests to verify they fail**

Run: `pnpm test:unit --run tests/unit/shared/safeStorageStore.test.ts`
Expected: Fail — module does not exist.

- [ ] **Step 4.3: Implement `safeStorageStore`**

Create `src/shared/safeStorageStore.ts`:

```ts
import type { z } from 'zod'

export interface SafeStorageLike {
  isAvailable: () => Promise<boolean>
  encrypt: (value: string) => Promise<string>
  decrypt: (value: string) => Promise<string>
}

export interface EncryptedStore<T> {
  read: () => Promise<T | null>
  write: (value: T) => Promise<void>
  clear: () => void
}

interface EncryptedPayload {
  _enc: true
  data: string
}

function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  return (
    typeof value === 'object'
    && value !== null
    && (value as { _enc?: unknown })._enc === true
    && typeof (value as { data?: unknown }).data === 'string'
  )
}

export function makeEncryptedStore<T>(params: {
  key: string
  schema: z.ZodType<T>
  safeStorage: SafeStorageLike
}): EncryptedStore<T> {
  const { key, schema, safeStorage } = params

  return {
    async read() {
      const raw = localStorage.getItem(key)
      if (!raw)
        return null

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      }
      catch {
        return null
      }

      let candidate: unknown = parsed
      if (isEncryptedPayload(parsed) && (await safeStorage.isAvailable().catch(() => false))) {
        try {
          const decrypted = await safeStorage.decrypt(parsed.data)
          candidate = JSON.parse(decrypted)
        }
        catch {
          return null
        }
      }

      const result = schema.safeParse(candidate)
      return result.success ? result.data : null
    },

    async write(value) {
      const json = JSON.stringify(value)
      let payload = json

      if (await safeStorage.isAvailable().catch(() => false)) {
        try {
          const encrypted = await safeStorage.encrypt(json)
          payload = JSON.stringify({ _enc: true, data: encrypted } satisfies EncryptedPayload)
        }
        catch {
          payload = json
        }
      }

      localStorage.setItem(key, payload)
    },

    clear() {
      localStorage.removeItem(key)
    },
  }
}
```

- [ ] **Step 4.4: Run tests to verify they pass**

Run: `pnpm test:unit --run tests/unit/shared/safeStorageStore.test.ts`
Expected: All 6 tests pass.

- [ ] **Step 4.5: Commit**

```bash
git add src/shared/safeStorageStore.ts tests/unit/shared/safeStorageStore.test.ts
git commit -m "feat(shared): generic safeStorage-backed Zod-validated store"
```

---

## Phase 3: `EnterpriseSession` module

### Task 5: Module skeleton and types

**Files:**
- Create: `src/enterprise/session.ts`
- Create: `src/enterprise/index.ts`

- [ ] **Step 5.1: Create empty module with type surface**

Create `src/enterprise/session.ts`:

```ts
import type { z } from 'zod'
import type { MatrixSession as MatrixSessionContract, MuonSession } from '@muon/enterprise-contracts'
import type { EncryptedStore, SafeStorageLike } from '@/shared/safeStorageStore'
import { muonSessionSchema, oauthTokenResponseSchema } from '@muon/enterprise-contracts'

export interface EnterpriseSession {
  muon: MuonSession
  matrix: MatrixSessionContract
}

export interface PkceTransientState {
  codeVerifier: string
  state: string
}

export interface EnterpriseSessionDeps {
  apiBaseUrl: string
  http: typeof fetch
  clock: () => number
  openUrl: (url: string) => Promise<void>
  muonStore: EncryptedStore<MuonSession>
  pkceStore: EncryptedStore<PkceTransientState>
  /** Read-only loader for the currently-stored MatrixSession, owned by the MatrixSession module. EnterpriseSession never writes Matrix storage. */
  readMatrixSession: () => Promise<MatrixSessionContract | null>
  refreshThresholdMs: number
  clientId: string
  redirectUri: string
}

export class EnterpriseSessionError extends Error {
  constructor(public readonly kind: 'invalid-callback' | 'state-mismatch' | 'no-pkce-state' | 'exchange-failed' | 'refresh-revoked' | 'refresh-network', message: string) {
    super(message)
    this.name = 'EnterpriseSessionError'
  }
}

// Implementations added in subsequent tasks
export async function start(_deps: EnterpriseSessionDeps): Promise<void> {
  throw new Error('not implemented')
}

export async function complete(_callbackUrl: string, _deps: EnterpriseSessionDeps): Promise<EnterpriseSession> {
  throw new Error('not implemented')
}

export async function refresh(_deps: EnterpriseSessionDeps): Promise<EnterpriseSession | null> {
  throw new Error('not implemented')
}

export async function restore(_deps: EnterpriseSessionDeps): Promise<EnterpriseSession | null> {
  throw new Error('not implemented')
}

export function clear(_deps: EnterpriseSessionDeps): void {
  throw new Error('not implemented')
}

export function parseEnterpriseAuthCallback(url: string): { code: string, state: string } | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'muon:' || parsed.hostname !== 'auth' || parsed.pathname !== '/callback')
      return null
    const code = parsed.searchParams.get('code')
    const state = parsed.searchParams.get('state')
    if (!code || !state)
      return null
    return { code, state }
  }
  catch {
    return null
  }
}

// Silence unused-import warnings on schemas while the module fills in
void muonSessionSchema
void oauthTokenResponseSchema
void ({} as z.ZodTypeAny)
```

Create `src/enterprise/index.ts`:

```ts
export * from './session'
```

- [ ] **Step 5.2: Type-check the skeleton**

Run: `pnpm type-check`
Expected: Pass (the placeholders still throw at runtime, but types resolve).

- [ ] **Step 5.3: Commit**

```bash
git add src/enterprise/session.ts src/enterprise/index.ts
git commit -m "feat(enterprise): skeleton for EnterpriseSession module"
```

---

### Task 6: Implement `start` (PKCE + browser open)

**Files:**
- Modify: `src/enterprise/session.ts`
- Test: `tests/unit/enterprise/session.test.ts`

- [ ] **Step 6.1: Write failing test for `start`**

Create `tests/unit/enterprise/session.test.ts`:

```ts
import type { MatrixSession, MuonSession } from '@muon/enterprise-contracts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { matrixSessionSchema, muonSessionSchema } from '@muon/enterprise-contracts'
import { complete, EnterpriseSessionError, type EnterpriseSessionDeps, type PkceTransientState, refresh, restore, start } from '@/enterprise/session'
import { makeEncryptedStore, type SafeStorageLike } from '@/shared/safeStorageStore'

const pkceTransientSchema = z.object({
  codeVerifier: z.string(),
  state: z.string(),
})

function plaintextSafeStorage(): SafeStorageLike {
  return {
    isAvailable: vi.fn().mockResolvedValue(false),
    encrypt: vi.fn(async s => s),
    decrypt: vi.fn(async s => s),
  }
}

function makeDeps(overrides: Partial<EnterpriseSessionDeps> = {}): EnterpriseSessionDeps {
  const safeStorage = plaintextSafeStorage()
  return {
    apiBaseUrl: 'https://api.example.com',
    http: vi.fn() as unknown as typeof fetch,
    clock: () => Date.parse('2026-05-16T00:00:00.000Z'),
    openUrl: vi.fn().mockResolvedValue(undefined),
    muonStore: makeEncryptedStore<MuonSession>({ key: 'test_muon', schema: muonSessionSchema, safeStorage }),
    pkceStore: makeEncryptedStore<PkceTransientState>({ key: 'test_pkce', schema: pkceTransientSchema, safeStorage }),
    readMatrixSession: vi.fn().mockResolvedValue(null),
    refreshThresholdMs: 24 * 60 * 60 * 1000,
    clientId: 'muon-desktop',
    redirectUri: 'muon://auth/callback',
    ...overrides,
  }
}

describe('EnterpriseSession.start', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists PKCE state and opens authorize URL with required params', async () => {
    const openUrl = vi.fn().mockResolvedValue(undefined)
    const deps = makeDeps({ openUrl })

    await start(deps)

    expect(openUrl).toHaveBeenCalledTimes(1)
    const openedUrl = new URL(openUrl.mock.calls[0]![0]! as string)
    expect(openedUrl.origin + openedUrl.pathname).toBe('https://api.example.com/api/oauth/authorize')
    expect(openedUrl.searchParams.get('client_id')).toBe('muon-desktop')
    expect(openedUrl.searchParams.get('redirect_uri')).toBe('muon://auth/callback')
    expect(openedUrl.searchParams.get('response_type')).toBe('code')
    expect(openedUrl.searchParams.get('code_challenge_method')).toBe('S256')
    expect(openedUrl.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(openedUrl.searchParams.get('state')).toBeTruthy()

    const pkce = await deps.pkceStore.read()
    expect(pkce).not.toBeNull()
    expect(pkce!.state).toBe(openedUrl.searchParams.get('state'))
  })
})
```

- [ ] **Step 6.2: Run test to verify it fails**

Run: `pnpm test:unit --run tests/unit/enterprise/session.test.ts`
Expected: Fail with `not implemented`.

- [ ] **Step 6.3: Implement `start`**

In `src/enterprise/session.ts`, replace the `start` placeholder. Add these helpers near the top (after imports):

```ts
function randomUrlToken(bytes = 32): string {
  const values = new Uint8Array(bytes)
  crypto.getRandomValues(values)
  return btoa(String.fromCharCode(...values))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

async function sha256Base64Url(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}
```

Then implement:

```ts
export async function start(deps: EnterpriseSessionDeps): Promise<void> {
  const codeVerifier = randomUrlToken()
  const state = randomUrlToken(16)
  const codeChallenge = await sha256Base64Url(codeVerifier)

  await deps.pkceStore.write({ codeVerifier, state })

  const authorizeUrl = new URL('/api/oauth/authorize', deps.apiBaseUrl)
  authorizeUrl.searchParams.set('client_id', deps.clientId)
  authorizeUrl.searchParams.set('redirect_uri', deps.redirectUri)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('code_challenge', codeChallenge)
  authorizeUrl.searchParams.set('code_challenge_method', 'S256')
  authorizeUrl.searchParams.set('state', state)

  await deps.openUrl(authorizeUrl.toString())
}
```

- [ ] **Step 6.4: Run test to verify it passes**

Run: `pnpm test:unit --run tests/unit/enterprise/session.test.ts -t start`
Expected: Pass.

- [ ] **Step 6.5: Commit**

```bash
git add src/enterprise/session.ts tests/unit/enterprise/session.test.ts
git commit -m "feat(enterprise): implement EnterpriseSession.start (PKCE + open browser)"
```

---

### Task 7: Implement `complete` (exchange code → EnterpriseSession)

**Files:**
- Modify: `src/enterprise/session.ts`
- Test: `tests/unit/enterprise/session.test.ts`

- [ ] **Step 7.1: Write failing tests for `complete`**

Append to `tests/unit/enterprise/session.test.ts`:

```ts
describe('EnterpriseSession.complete', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('rejects an invalid callback URL', async () => {
    const deps = makeDeps()
    await expect(complete('not-a-url', deps)).rejects.toBeInstanceOf(EnterpriseSessionError)
  })

  it('rejects when no PKCE state was started', async () => {
    const deps = makeDeps()
    await expect(complete('muon://auth/callback?code=c&state=s', deps)).rejects.toThrow(/PKCE/i)
  })

  it('rejects when callback state does not match stored state', async () => {
    const deps = makeDeps()
    await deps.pkceStore.write({ codeVerifier: 'v', state: 'expected' })
    await expect(complete('muon://auth/callback?code=c&state=wrong', deps)).rejects.toThrow(/state/i)
  })

  it('exchanges the code and persists both sessions, clearing PKCE state', async () => {
    const http = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        muonSession: {
          accessToken: 'mat',
          refreshToken: 'mrt',
          expiresAt: '2030-01-01T00:00:00.000Z',
          deviceName: 'Muon Desktop',
        },
        matrixSession: {
          serverUrl: 'https://matrix.example.com',
          userId: '@u:example.com',
          accessToken: 'xat',
          deviceId: 'DEV',
        },
      }),
    }) as unknown as typeof fetch

    const deps = makeDeps({ http })
    await deps.pkceStore.write({ codeVerifier: 'verifier', state: 'st' })

    const session = await complete('muon://auth/callback?code=abc&state=st', deps)

    expect(session.muon.accessToken).toBe('mat')
    expect(session.muon.deviceName).toBe('Muon Desktop')
    expect(session.matrix.userId).toBe('@u:example.com')

    // EnterpriseSession persists ONLY the MuonSession; the returned MatrixSession is the lifecycle orchestrator's job to activate.
    expect(await deps.muonStore.read()).toEqual(session.muon)
    expect(await deps.pkceStore.read()).toBeNull()

    const [calledUrl, calledInit] = (http as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(String(calledUrl)).toBe('https://api.example.com/api/oauth/token')
    const body = JSON.parse((calledInit as RequestInit).body as string)
    expect(body.code).toBe('abc')
    expect(body.codeVerifier).toBe('verifier')
    expect(body.clientId).toBe('muon-desktop')
    expect(body.redirectUri).toBe('muon://auth/callback')
    expect(body.deviceName).toBe('Muon Desktop')
  })

  it('throws on non-ok response and does not persist anything', async () => {
    const http = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'bad_request' }),
    }) as unknown as typeof fetch
    const deps = makeDeps({ http })
    await deps.pkceStore.write({ codeVerifier: 'v', state: 's' })

    await expect(complete('muon://auth/callback?code=c&state=s', deps)).rejects.toThrow()
    expect(await deps.muonStore.read()).toBeNull()
  })
})
```

- [ ] **Step 7.2: Run tests to verify they fail**

Run: `pnpm test:unit --run tests/unit/enterprise/session.test.ts -t complete`
Expected: Fail with `not implemented`.

- [ ] **Step 7.3: Implement `complete`**

Replace the `complete` placeholder in `src/enterprise/session.ts`:

```ts
const DEFAULT_DEVICE_NAME = 'Muon Desktop'

export async function complete(callbackUrl: string, deps: EnterpriseSessionDeps): Promise<EnterpriseSession> {
  const callback = parseEnterpriseAuthCallback(callbackUrl)
  if (!callback)
    throw new EnterpriseSessionError('invalid-callback', 'Invalid enterprise auth callback')

  const pkce = await deps.pkceStore.read()
  if (!pkce)
    throw new EnterpriseSessionError('no-pkce-state', 'Enterprise login was not started on this device (no PKCE state)')

  if (pkce.state !== callback.state)
    throw new EnterpriseSessionError('state-mismatch', 'Enterprise login state does not match this device')

  const response = await deps.http(`${deps.apiBaseUrl}/api/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      code: callback.code,
      codeVerifier: pkce.codeVerifier,
      redirectUri: deps.redirectUri,
      clientId: deps.clientId,
      deviceName: DEFAULT_DEVICE_NAME,
    }),
  })

  const payload = await response.json()
  if (!response.ok)
    throw new EnterpriseSessionError('exchange-failed', payload?.error ?? 'Enterprise login failed')

  const tokenResponse = oauthTokenResponseSchema.parse(payload)
  const muon = tokenResponse.muonSession
  const matrix = tokenResponse.matrixSession

  await deps.muonStore.write(muon)
  deps.pkceStore.clear()

  // Note: the returned MatrixSession is NOT persisted here. The lifecycle orchestrator
  // is responsible for calling activateMatrixSession(matrix) which persists + creates the client.
  return { muon, matrix }
}
```

- [ ] **Step 7.4: Run tests to verify they pass**

Run: `pnpm test:unit --run tests/unit/enterprise/session.test.ts -t complete`
Expected: All 5 `complete` tests pass.

- [ ] **Step 7.5: Commit**

```bash
git add src/enterprise/session.ts tests/unit/enterprise/session.test.ts
git commit -m "feat(enterprise): implement EnterpriseSession.complete (exchange + persist)"
```

---

### Task 8: Implement `refresh`

**Files:**
- Modify: `src/enterprise/session.ts`
- Test: `tests/unit/enterprise/session.test.ts`

- [ ] **Step 8.1: Write failing tests for `refresh`**

Append to `tests/unit/enterprise/session.test.ts`:

```ts
const validMatrix: MatrixSession = {
  serverUrl: 'https://matrix.example.com',
  userId: '@u:example.com',
  accessToken: 'xat',
  deviceId: 'DEV',
}

const validMuon: MuonSession = {
  accessToken: 'old-at',
  refreshToken: 'old-rt',
  expiresAt: '2030-01-01T00:00:00.000Z',
  deviceName: 'My Laptop',
}

describe('EnterpriseSession.refresh', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when no MuonSession is stored', async () => {
    const deps = makeDeps()
    const result = await refresh(deps)
    expect(result).toBeNull()
  })

  it('rotates tokens, persists the new MuonSession, and uses the stored deviceName in the request', async () => {
    const http = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        muonSession: {
          accessToken: 'new-at',
          refreshToken: 'new-rt',
          expiresAt: '2031-01-01T00:00:00.000Z',
          deviceName: 'My Laptop',
        },
        matrixSession: validMatrix,
      }),
    }) as unknown as typeof fetch

    const deps = makeDeps({ http })
    await deps.muonStore.write(validMuon)

    const result = await refresh(deps)
    expect(result?.muon.accessToken).toBe('new-at')
    expect(result?.muon.deviceName).toBe('My Laptop')
    expect(result?.matrix).toEqual(validMatrix)

    const stored = await deps.muonStore.read()
    expect(stored?.accessToken).toBe('new-at')

    const [, init] = (http as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.refreshToken).toBe('old-rt')
    expect(body.deviceName).toBe('My Laptop')
  })

  it('clears the stored MuonSession on 401 (server-side revoke), does not touch Matrix storage', async () => {
    const http = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'invalid_refresh_token' }),
    }) as unknown as typeof fetch

    const readMatrixSession = vi.fn().mockResolvedValue(validMatrix)
    const deps = makeDeps({ http, readMatrixSession })
    await deps.muonStore.write(validMuon)

    await expect(refresh(deps)).rejects.toBeInstanceOf(EnterpriseSessionError)

    expect(await deps.muonStore.read()).toBeNull()
    // readMatrixSession was not invoked from refresh — refresh does not own Matrix lifecycle
    expect(readMatrixSession).not.toHaveBeenCalled()
  })

  it('keeps stored MuonSession on network error', async () => {
    const http = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch
    const deps = makeDeps({ http })
    await deps.muonStore.write(validMuon)

    await expect(refresh(deps)).rejects.toBeInstanceOf(EnterpriseSessionError)
    expect(await deps.muonStore.read()).toEqual(validMuon)
  })
})
```

- [ ] **Step 8.2: Run tests to verify they fail**

Run: `pnpm test:unit --run tests/unit/enterprise/session.test.ts -t refresh`
Expected: Fail.

- [ ] **Step 8.3: Implement `refresh`**

Replace `refresh` in `src/enterprise/session.ts`:

```ts
export async function refresh(deps: EnterpriseSessionDeps): Promise<EnterpriseSession | null> {
  const stored = await deps.muonStore.read()
  if (!stored)
    return null

  let response: Response
  try {
    response = await deps.http(`${deps.apiBaseUrl}/api/oauth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        refreshToken: stored.refreshToken,
        clientId: deps.clientId,
        deviceName: stored.deviceName,
      }),
    })
  }
  catch (err) {
    throw new EnterpriseSessionError('refresh-network', err instanceof Error ? err.message : 'Network error')
  }

  if (!response.ok) {
    deps.muonStore.clear()
    throw new EnterpriseSessionError('refresh-revoked', `Refresh failed with status ${response.status}`)
  }

  const tokenResponse = oauthTokenResponseSchema.parse(await response.json())
  await deps.muonStore.write(tokenResponse.muonSession)

  // Matrix session comes from the server's refresh response, not from any desktop store
  // (EnterpriseSession does not own Matrix storage).
  return { muon: tokenResponse.muonSession, matrix: tokenResponse.matrixSession }
}
```

- [ ] **Step 8.4: Run tests to verify they pass**

Run: `pnpm test:unit --run tests/unit/enterprise/session.test.ts -t refresh`
Expected: All 4 refresh tests pass.

- [ ] **Step 8.5: Commit**

```bash
git add src/enterprise/session.ts tests/unit/enterprise/session.test.ts
git commit -m "feat(enterprise): implement EnterpriseSession.refresh with 401 clear and network keep"
```

---

### Task 9: Implement `restore` (with near-expiry auto-refresh)

**Files:**
- Modify: `src/enterprise/session.ts`
- Test: `tests/unit/enterprise/session.test.ts`

- [ ] **Step 9.1: Write failing tests for `restore`**

Append to `tests/unit/enterprise/session.test.ts`:

```ts
describe('EnterpriseSession.restore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when no MuonSession is stored', async () => {
    const deps = makeDeps()
    expect(await restore(deps)).toBeNull()
  })

  it('returns the stored bundle without refreshing when not near expiry', async () => {
    const http = vi.fn() as unknown as typeof fetch
    const readMatrixSession = vi.fn().mockResolvedValue(validMatrix)
    const deps = makeDeps({
      http,
      readMatrixSession,
      clock: () => Date.parse('2026-05-16T00:00:00.000Z'),
    })

    const farFuture: MuonSession = {
      ...validMuon,
      expiresAt: '2026-06-16T00:00:00.000Z', // 31 days away — beyond 24h threshold
    }
    await deps.muonStore.write(farFuture)

    const result = await restore(deps)
    expect(result).toEqual({ muon: farFuture, matrix: validMatrix })
    expect(http).not.toHaveBeenCalled()
    expect(readMatrixSession).toHaveBeenCalled()
  })

  it('returns null when no MatrixSession exists even if MuonSession is valid', async () => {
    const readMatrixSession = vi.fn().mockResolvedValue(null)
    const deps = makeDeps({
      readMatrixSession,
      clock: () => Date.parse('2026-05-16T00:00:00.000Z'),
    })
    const farFuture: MuonSession = { ...validMuon, expiresAt: '2026-06-16T00:00:00.000Z' }
    await deps.muonStore.write(farFuture)

    expect(await restore(deps)).toBeNull()
  })

  it('refreshes when within the threshold and returns the rotated bundle', async () => {
    const http = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        muonSession: {
          accessToken: 'rotated',
          refreshToken: 'rotated-rt',
          expiresAt: '2031-01-01T00:00:00.000Z',
          deviceName: 'My Laptop',
        },
        matrixSession: validMatrix,
      }),
    }) as unknown as typeof fetch

    const deps = makeDeps({
      http,
      clock: () => Date.parse('2026-05-16T00:00:00.000Z'),
    })

    const nearExpiry: MuonSession = {
      ...validMuon,
      expiresAt: '2026-05-16T12:00:00.000Z', // 12h away, within 24h threshold
    }
    await deps.muonStore.write(nearExpiry)

    const result = await restore(deps)
    expect(http).toHaveBeenCalledTimes(1)
    expect(result?.muon.accessToken).toBe('rotated')
    expect(result?.matrix).toEqual(validMatrix)
  })

  it('returns the still-valid stored bundle when near-expiry refresh fails with network error', async () => {
    const http = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch
    const readMatrixSession = vi.fn().mockResolvedValue(validMatrix)
    const deps = makeDeps({
      http,
      readMatrixSession,
      clock: () => Date.parse('2026-05-16T00:00:00.000Z'),
    })
    const nearExpiry: MuonSession = {
      ...validMuon,
      expiresAt: '2026-05-16T12:00:00.000Z',
    }
    await deps.muonStore.write(nearExpiry)

    const result = await restore(deps)
    expect(result?.muon.accessToken).toBe(nearExpiry.accessToken)
    expect(result?.matrix).toEqual(validMatrix)
  })

  it('returns null when refresh detects a revoked session (401)', async () => {
    const http = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'invalid_refresh_token' }),
    }) as unknown as typeof fetch
    const deps = makeDeps({
      http,
      clock: () => Date.parse('2026-05-16T00:00:00.000Z'),
    })
    const nearExpiry: MuonSession = {
      ...validMuon,
      expiresAt: '2026-05-16T12:00:00.000Z',
    }
    await deps.muonStore.write(nearExpiry)

    expect(await restore(deps)).toBeNull()
    expect(await deps.muonStore.read()).toBeNull()
  })
})
```

- [ ] **Step 9.2: Run tests to verify they fail**

Run: `pnpm test:unit --run tests/unit/enterprise/session.test.ts -t restore`
Expected: Fail.

- [ ] **Step 9.3: Implement `restore`**

Replace `restore` in `src/enterprise/session.ts`:

```ts
export async function restore(deps: EnterpriseSessionDeps): Promise<EnterpriseSession | null> {
  const muon = await deps.muonStore.read()
  if (!muon)
    return null

  const msUntilExpiry = Date.parse(muon.expiresAt) - deps.clock()
  const needsRefresh = msUntilExpiry < deps.refreshThresholdMs

  if (needsRefresh) {
    try {
      return await refresh(deps)
    }
    catch (err) {
      if (!(err instanceof EnterpriseSessionError && err.kind === 'refresh-network'))
        return null
      // Network error — fall through to use the existing stored MuonSession.
    }
  }

  const matrix = await deps.readMatrixSession()
  if (!matrix)
    return null

  return { muon, matrix }
}
```

- [ ] **Step 9.4: Run tests to verify they pass**

Run: `pnpm test:unit --run tests/unit/enterprise/session.test.ts -t restore`
Expected: All 5 restore tests pass.

- [ ] **Step 9.5: Commit**

```bash
git add src/enterprise/session.ts tests/unit/enterprise/session.test.ts
git commit -m "feat(enterprise): implement EnterpriseSession.restore with near-expiry auto-refresh"
```

---

### Task 10: Implement `clear` and finalise default-deps factory

**Files:**
- Modify: `src/enterprise/session.ts`
- Modify: `src/enterprise/index.ts`
- Test: `tests/unit/enterprise/session.test.ts`

- [ ] **Step 10.1: Write failing test for `clear`**

Append to `tests/unit/enterprise/session.test.ts`:

```ts
describe('EnterpriseSession.clear', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('clears MuonSession and PKCE state but does NOT touch Matrix storage (owned by MatrixSession)', async () => {
    const deps = makeDeps()
    await deps.muonStore.write(validMuon)
    await deps.pkceStore.write({ codeVerifier: 'v', state: 's' })

    const { clear } = await import('@/enterprise/session')
    clear(deps)

    expect(await deps.muonStore.read()).toBeNull()
    expect(await deps.pkceStore.read()).toBeNull()
  })
})
```

- [ ] **Step 10.2: Run test to verify it fails**

Run: `pnpm test:unit --run tests/unit/enterprise/session.test.ts -t clear`
Expected: Fail (placeholder throws).

- [ ] **Step 10.3: Implement `clear`**

Replace `clear` in `src/enterprise/session.ts`:

```ts
export function clear(deps: EnterpriseSessionDeps): void {
  deps.muonStore.clear()
  deps.pkceStore.clear()
  // Matrix storage is owned by the MatrixSession module — cleared by logoutMatrix().
}
```

- [ ] **Step 10.4: Add a `defaultDeps` factory for production use**

At the top of `src/enterprise/session.ts`, ensure these imports are present (add any missing):

```ts
import { z } from 'zod'
import { matrixSessionSchema, muonSessionSchema, oauthTokenResponseSchema } from '@muon/enterprise-contracts'
import { getDesktopBridge, isElectronRuntime } from '@/electron/bridge'
import { openUrl as defaultOpenUrl } from '@/electron/opener'
import { makeEncryptedStore, type SafeStorageLike } from '@/shared/safeStorageStore'
import { readMatrixSessionFromStore } from '@/matrix/auth'
```

Then declare the PKCE schema once at module scope, near the top (after type declarations):

```ts
const pkceTransientSchema = z.object({
  codeVerifier: z.string().min(1),
  state: z.string().min(1),
})
```

Append the production factory at the bottom of the file:

```ts
const REFRESH_NEAR_EXPIRY_MS = 24 * 60 * 60 * 1000
const STORAGE_KEY_MUON = 'muon_enterprise_session'
const STORAGE_KEY_PKCE = 'muon_enterprise_pkce'

function bridgeSafeStorage(): SafeStorageLike {
  if (!isElectronRuntime()) {
    return {
      isAvailable: async () => false,
      encrypt: async s => s,
      decrypt: async s => s,
    }
  }
  return {
    isAvailable: () => getDesktopBridge()!.safeStorage.isAvailable(),
    encrypt: s => getDesktopBridge()!.safeStorage.encrypt(s),
    decrypt: s => getDesktopBridge()!.safeStorage.decrypt(s),
  }
}

export function defaultEnterpriseSessionDeps(apiBaseUrl = import.meta.env.VITE_MUON_API_BASE_URL): EnterpriseSessionDeps {
  const safeStorage = bridgeSafeStorage()
  return {
    apiBaseUrl: String(apiBaseUrl || '').replace(/\/+$/g, ''),
    http: globalThis.fetch.bind(globalThis),
    clock: () => Date.now(),
    openUrl: defaultOpenUrl,
    muonStore: makeEncryptedStore({ key: STORAGE_KEY_MUON, schema: muonSessionSchema, safeStorage }),
    pkceStore: makeEncryptedStore({ key: STORAGE_KEY_PKCE, schema: pkceTransientSchema, safeStorage }),
    readMatrixSession: readMatrixSessionFromStore,
    refreshThresholdMs: REFRESH_NEAR_EXPIRY_MS,
    clientId: 'muon-desktop',
    redirectUri: 'muon://auth/callback',
  }
}

export function isEnterpriseAuthConfigured(apiBaseUrl = import.meta.env.VITE_MUON_API_BASE_URL): boolean {
  return String(apiBaseUrl || '').replace(/\/+$/g, '').length > 0
}
```

> **Note:** `readMatrixSessionFromStore` is added to `src/matrix/auth.ts` in Task 11 (a read-only loader: reads from the `muon_auth` localStorage key, returns the parsed MatrixSession or null, does NOT call `createClient`). If Task 11 hasn't run yet and you're working out of order, stub it as `async () => null` and revisit.

- [ ] **Step 10.5: Clean up imports**

Open `src/enterprise/session.ts` and verify:
1. There is exactly one `import { z } from 'zod'` at top.
2. The `void` placeholder statements added in Task 5 are removed (`void muonSessionSchema`, `void oauthTokenResponseSchema`, and the `void ({} as z.ZodTypeAny)` line).
3. `pkceTransientSchema` is declared once at module scope.

- [ ] **Step 10.6: Run full enterprise session tests**

Run: `pnpm test:unit --run tests/unit/enterprise/session.test.ts`
Expected: All tests pass.

- [ ] **Step 10.7: Commit**

```bash
git add src/enterprise/session.ts src/enterprise/index.ts tests/unit/enterprise/session.test.ts
git commit -m "feat(enterprise): implement clear() and defaultEnterpriseSessionDeps()"
```

---

## Phase 4: Slim down `MatrixSession` (`src/matrix/auth.ts`)

### Task 11: Reduce `src/matrix/auth.ts` to MatrixSession-only surface

**Files:**
- Modify: `src/matrix/auth.ts`
- Modify: `src/matrix/index.ts`
- Test: `tests/unit/matrix/auth.test.ts`

- [ ] **Step 11.1: Move enterprise-flow tests out of `tests/unit/matrix/auth.test.ts`**

Open `tests/unit/matrix/auth.test.ts`. Identify all `it(...)` blocks that touch:
- `startEnterpriseLogin`, `completeEnterpriseLogin`, `parseEnterpriseAuthCallback`, `refreshEnterpriseSession`, `maybeRefreshOnStartup`, `ENTERPRISE_SESSION_KEY`, `ENTERPRISE_PKCE_KEY`.

Delete those `it` blocks. The equivalent coverage now lives in `tests/unit/enterprise/session.test.ts`.

Keep only tests for: `login`, `register`, `restoreSession`-Matrix-side, `logout`-Matrix-side.

- [ ] **Step 11.2: Verify the remaining auth tests still fail or pass under the new slim API**

For each remaining test, update names to the new surface:
- `login` → keep (or rename to `loginWithPassword` if you wish)
- `logout` → will become `logoutMatrix` once code is updated
- `restoreSession` → will become `restoreMatrixSession` once code is updated

Run: `pnpm test:unit --run tests/unit/matrix/auth.test.ts`
Expected: Some tests fail because `auth.ts` still exports the old names. Continue.

- [ ] **Step 11.3: Rewrite `src/matrix/auth.ts` to the slim surface**

Replace the entire contents of `src/matrix/auth.ts` with:

```ts
import type { LoginCredentials, RegisterParams } from './types'
import { matrixSessionSchema, type MatrixSession } from '@muon/enterprise-contracts'
import { makeEncryptedStore, type SafeStorageLike } from '@/shared/safeStorageStore'
import { getDesktopBridge, isElectronRuntime } from '@/electron/bridge'
import { createClient, destroyClient, getClient } from './client'
import { unbindClientEvents } from './events'

const STORAGE_KEY = 'muon_auth'
const LEADING_AT_RE = /^@/

function bridgeSafeStorage(): SafeStorageLike {
  if (!isElectronRuntime()) {
    return {
      isAvailable: async () => false,
      encrypt: async s => s,
      decrypt: async s => s,
    }
  }
  return {
    isAvailable: () => getDesktopBridge()!.safeStorage.isAvailable(),
    encrypt: s => getDesktopBridge()!.safeStorage.encrypt(s),
    decrypt: s => getDesktopBridge()!.safeStorage.decrypt(s),
  }
}

function matrixSessionStore() {
  return makeEncryptedStore({ key: STORAGE_KEY, schema: matrixSessionSchema, safeStorage: bridgeSafeStorage() })
}

export async function loginWithPassword(serverUrl: string, credentials: LoginCredentials): Promise<MatrixSession> {
  const client = createClient({ serverUrl })
  const localpart = credentials.username.replace(LEADING_AT_RE, '').split(':')[0]

  const response = await client.login('m.login.password', {
    identifier: { type: 'm.id.user', user: localpart },
    password: credentials.password,
  })

  const session: MatrixSession = {
    serverUrl,
    userId: response.user_id,
    accessToken: response.access_token,
    deviceId: response.device_id,
  }
  await matrixSessionStore().write(session)
  createClient(session)
  return session
}

export async function register(serverUrl: string, params: RegisterParams): Promise<MatrixSession> {
  const client = createClient({ serverUrl })
  const localpart = params.username.replace(LEADING_AT_RE, '').split(':')[0]
  const response = await client.register(localpart, params.password, null, { type: 'm.login.dummy' })

  const session: MatrixSession = {
    serverUrl,
    userId: response.user_id,
    accessToken: response.access_token!,
    deviceId: response.device_id!,
  }
  await matrixSessionStore().write(session)
  createClient(session)

  if (params.displayName)
    await getClient().setDisplayName(params.displayName)

  return session
}

/** Read-only loader. Used by EnterpriseSession.restore via the readMatrixSession dep — does NOT create a Matrix client. */
export async function readMatrixSessionFromStore(): Promise<MatrixSession | null> {
  return matrixSessionStore().read()
}

/** Full restore: read + create client. Used by lifecycle.bootstrap when there is no EnterpriseSession. */
export async function restoreMatrixSession(): Promise<MatrixSession | null> {
  const session = await matrixSessionStore().read()
  if (!session)
    return null
  createClient(session)
  return session
}

/** Persist the given session and create the Matrix client. Called by lifecycle after a fresh enterprise sign-in. */
export async function activateMatrixSession(session: MatrixSession): Promise<void> {
  await matrixSessionStore().write(session)
  createClient(session)
}

/**
 * Log out from the Matrix homeserver and tear down the local client.
 * Caller (lifecycle.signOut) is responsible for stopping sync FIRST.
 */
export async function logoutMatrix(): Promise<void> {
  try {
    await getClient().logout(true)
  }
  catch {
    // ignore — homeserver may be unreachable; continue with local teardown.
  }

  try {
    unbindClientEvents()
  }
  catch {
    // continue
  }

  matrixSessionStore().clear()
  destroyClient()
}

export function clearMatrixSessionStore(): void {
  matrixSessionStore().clear()
}
```

- [ ] **Step 11.4: Update `src/matrix/index.ts` re-exports**

Open `src/matrix/index.ts:1`. Replace the line:

```ts
export { completeEnterpriseLogin, isEnterpriseAuthConfigured, login, logout, parseEnterpriseAuthCallback, register, restoreSession, startEnterpriseLogin } from './auth'
```

With:

```ts
export { activateMatrixSession, clearMatrixSessionStore, loginWithPassword, logoutMatrix, readMatrixSessionFromStore, register, restoreMatrixSession } from './auth'
```

- [ ] **Step 11.5: Update the remaining MatrixSession tests to use new names**

In `tests/unit/matrix/auth.test.ts`, rename:
- `import { login, logout, restoreSession } ...` → `import { loginWithPassword, logoutMatrix, restoreMatrixSession } ...`
- All call sites accordingly.

- [ ] **Step 11.6: Run the MatrixSession tests**

Run: `pnpm test:unit --run tests/unit/matrix/auth.test.ts`
Expected: All remaining (non-enterprise) tests pass.

- [ ] **Step 11.7: Run full unit suite to find consumers of the old exports**

Run: `pnpm test:unit --run`
Expected: Failures in any test or app file that still imports `login`/`logout`/`restoreSession`/`startEnterpriseLogin`/`completeEnterpriseLogin`/`parseEnterpriseAuthCallback`/`isEnterpriseAuthConfigured` from `@matrix/index`. **These will be fixed in Phase 5/6.** Note which files break.

- [ ] **Step 11.8: Commit (work-in-progress checkpoint)**

```bash
git add src/matrix/auth.ts src/matrix/index.ts tests/unit/matrix/auth.test.ts
git commit -m "refactor(matrix): slim auth.ts to MatrixSession-only surface

Enterprise/PKCE/Muon refresh logic moved to src/enterprise/session.ts in
prior commits. Call sites updated in subsequent commits."
```

---

## Phase 5: Lifecycle orchestrator

### Task 12: Create `src/auth/lifecycle.ts` with failing tests

**Files:**
- Create: `src/auth/lifecycle.ts`
- Test: `tests/unit/auth/lifecycle.test.ts`

- [ ] **Step 12.1: Write failing tests for the lifecycle**

Create `tests/unit/auth/lifecycle.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockStart = vi.fn()
const mockComplete = vi.fn()
const mockRestore = vi.fn()
const mockClear = vi.fn()
const mockLoginWithPassword = vi.fn()
const mockRestoreMatrixSession = vi.fn()
const mockLogoutMatrix = vi.fn()
const mockActivateMatrixSession = vi.fn()
const mockBindClientEvents = vi.fn()
const mockUnbindClientEvents = vi.fn()
const mockStartSync = vi.fn()
const mockStopSync = vi.fn()

vi.mock('@/enterprise/session', () => ({
  start: mockStart,
  complete: mockComplete,
  restore: mockRestore,
  clear: mockClear,
  defaultEnterpriseSessionDeps: vi.fn(() => ({ apiBaseUrl: 'https://api.example.com' })),
  isEnterpriseAuthConfigured: vi.fn(() => true),
}))

vi.mock('@matrix/index', () => ({
  loginWithPassword: mockLoginWithPassword,
  restoreMatrixSession: mockRestoreMatrixSession,
  logoutMatrix: mockLogoutMatrix,
  activateMatrixSession: mockActivateMatrixSession,
  bindClientEvents: mockBindClientEvents,
  unbindClientEvents: mockUnbindClientEvents,
  startSync: mockStartSync,
  stopSync: mockStopSync,
}))

describe('lifecycle.bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns restored=false when no session of any kind exists', async () => {
    mockRestore.mockResolvedValue(null)
    mockRestoreMatrixSession.mockResolvedValue(null)

    const { bootstrap } = await import('@/auth/lifecycle')
    const result = await bootstrap()

    expect(result.restored).toBe(false)
    expect(mockBindClientEvents).not.toHaveBeenCalled()
    expect(mockStartSync).not.toHaveBeenCalled()
  })

  it('activates Matrix client, binds events, and starts sync when EnterpriseSession restores', async () => {
    mockRestore.mockResolvedValue({
      muon: { accessToken: 'a', refreshToken: 'r', expiresAt: '2030-01-01T00:00:00.000Z', deviceName: 'D' },
      matrix: { serverUrl: 'm', userId: '@u:m', accessToken: 'ma', deviceId: 'd' },
    })

    const { bootstrap } = await import('@/auth/lifecycle')
    const result = await bootstrap()

    expect(result.restored).toBe(true)
    expect(mockActivateMatrixSession).toHaveBeenCalledWith({
      serverUrl: 'm',
      userId: '@u:m',
      accessToken: 'ma',
      deviceId: 'd',
    })
    expect(mockBindClientEvents).toHaveBeenCalled()
    expect(mockStartSync).toHaveBeenCalled()
  })

  it('falls back to MatrixSession-only restore when no EnterpriseSession', async () => {
    mockRestore.mockResolvedValue(null)
    mockRestoreMatrixSession.mockResolvedValue({ serverUrl: 'm', userId: '@u:m', accessToken: 'ma', deviceId: 'd' })

    const { bootstrap } = await import('@/auth/lifecycle')
    const result = await bootstrap()

    expect(result.restored).toBe(true)
    expect(mockBindClientEvents).toHaveBeenCalled()
    expect(mockStartSync).toHaveBeenCalled()
  })
})

describe('lifecycle.signInWithPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('logs in with password then binds events and starts sync', async () => {
    mockLoginWithPassword.mockResolvedValue({ serverUrl: 's', userId: '@u:s', accessToken: 'a', deviceId: 'd' })

    const { signInWithPassword } = await import('@/auth/lifecycle')
    await signInWithPassword('https://matrix.example.com', { username: 'u', password: 'p' })

    expect(mockLoginWithPassword).toHaveBeenCalledWith('https://matrix.example.com', { username: 'u', password: 'p' })
    expect(mockBindClientEvents).toHaveBeenCalled()
    expect(mockStartSync).toHaveBeenCalled()
  })
})

describe('lifecycle.signInWithEnterprise', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('completes the enterprise flow, activates Matrix, binds events, starts sync', async () => {
    mockComplete.mockResolvedValue({
      muon: { accessToken: 'a', refreshToken: 'r', expiresAt: '2030-01-01T00:00:00.000Z', deviceName: 'D' },
      matrix: { serverUrl: 'm', userId: '@u:m', accessToken: 'ma', deviceId: 'd' },
    })

    const { signInWithEnterprise } = await import('@/auth/lifecycle')
    await signInWithEnterprise('muon://auth/callback?code=c&state=s')

    expect(mockComplete).toHaveBeenCalled()
    expect(mockActivateMatrixSession).toHaveBeenCalled()
    expect(mockBindClientEvents).toHaveBeenCalled()
    expect(mockStartSync).toHaveBeenCalled()
  })
})

describe('lifecycle.signOut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stops sync, logs out of Matrix, clears EnterpriseSession storage', async () => {
    const calls: string[] = []
    mockStopSync.mockImplementation(() => { calls.push('stopSync') })
    mockLogoutMatrix.mockImplementation(async () => { calls.push('logoutMatrix') })
    mockClear.mockImplementation(() => { calls.push('enterprise.clear') })

    const { signOut } = await import('@/auth/lifecycle')
    await signOut()

    // stopSync first, then Matrix logout, then enterprise clear
    expect(calls).toEqual(['stopSync', 'logoutMatrix', 'enterprise.clear'])
  })
})
```

- [ ] **Step 12.2: Run tests to verify they fail**

Run: `pnpm test:unit --run tests/unit/auth/lifecycle.test.ts`
Expected: Fail — module does not exist.

- [ ] **Step 12.3: Implement `src/auth/lifecycle.ts`**

Create `src/auth/lifecycle.ts`:

```ts
import type { LoginCredentials } from '@matrix/types'
import { activateMatrixSession, bindClientEvents, logoutMatrix, restoreMatrixSession, startSync, stopSync } from '@matrix/index'
import { clear as clearEnterprise, complete as completeEnterprise, defaultEnterpriseSessionDeps, restore as restoreEnterprise } from '@/enterprise/session'

export interface BootstrapResult {
  restored: boolean
}

export async function bootstrap(): Promise<BootstrapResult> {
  const deps = defaultEnterpriseSessionDeps()

  const enterprise = await restoreEnterprise(deps).catch(() => null)
  if (enterprise) {
    await activateMatrixSession(enterprise.matrix)
    bindClientEvents()
    startSync()
    return { restored: true }
  }

  const matrixOnly = await restoreMatrixSession()
  if (matrixOnly) {
    bindClientEvents()
    startSync()
    return { restored: true }
  }

  return { restored: false }
}

export async function signInWithPassword(serverUrl: string, credentials: LoginCredentials): Promise<void> {
  const { loginWithPassword } = await import('@matrix/index')
  await loginWithPassword(serverUrl, credentials)
  bindClientEvents()
  startSync()
}

export async function signInWithEnterprise(callbackUrl: string): Promise<void> {
  const deps = defaultEnterpriseSessionDeps()
  const session = await completeEnterprise(callbackUrl, deps)
  await activateMatrixSession(session.matrix)
  bindClientEvents()
  startSync()
}

export async function startEnterpriseSignIn(): Promise<void> {
  const { start } = await import('@/enterprise/session')
  await start(defaultEnterpriseSessionDeps())
}

export async function signOut(): Promise<void> {
  stopSync()
  await logoutMatrix()
  clearEnterprise(defaultEnterpriseSessionDeps())
}

export { isEnterpriseAuthConfigured } from '@/enterprise/session'
```

- [ ] **Step 12.4: Run tests to verify they pass**

Run: `pnpm test:unit --run tests/unit/auth/lifecycle.test.ts`
Expected: All tests pass.

- [ ] **Step 12.5: Commit**

```bash
git add src/auth/lifecycle.ts tests/unit/auth/lifecycle.test.ts
git commit -m "feat(auth): lifecycle orchestrator (bootstrap/signIn/signOut)"
```

---

## Phase 6: Migrate call sites

### Task 13: Update `src/app/App.vue` to use `bootstrap()`

**Files:**
- Modify: `src/app/App.vue:2, 31-44`

- [ ] **Step 13.1: Update the import and the onMounted block**

In `src/app/App.vue`, change the import on line 2:

```ts
import { syncState } from '@matrix/index'
import { bootstrap } from '@/auth/lifecycle'
```

Then replace the body of the `try` block starting at line 30 (`const restored = await restoreSession()`) with:

```ts
try {
  const { restored } = await bootstrap()
  if (!restored)
    router.replace('/login')
}
```

Remove the now-unused `bindClientEvents`, `startSync`, `restoreSession` from the import.

- [ ] **Step 13.2: Run unit tests**

Run: `pnpm test:unit --run`
Expected: Pass.

- [ ] **Step 13.3: Type-check**

Run: `pnpm type-check`
Expected: Pass.

- [ ] **Step 13.4: Commit**

```bash
git add src/app/App.vue
git commit -m "refactor(app): use lifecycle.bootstrap on startup"
```

---

### Task 14: Update `src/features/auth/components/LoginPage.vue`

**Files:**
- Modify: `src/features/auth/components/LoginPage.vue:2, 125-160` (line numbers approximate — read the file)

- [ ] **Step 14.1: Replace the imports**

In `src/features/auth/components/LoginPage.vue`, find the line:

```ts
import { bindClientEvents, completeEnterpriseLogin, isEnterpriseAuthConfigured, login, register, startEnterpriseLogin, startSync } from '@matrix/index'
```

Replace with:

```ts
import { register } from '@matrix/index'
import { isEnterpriseAuthConfigured, signInWithEnterprise, signInWithPassword, startEnterpriseSignIn } from '@/auth/lifecycle'
```

(If `register` is also called — check the file; if so, it stays imported from `@matrix/index`. If not, drop the import.)

- [ ] **Step 14.2: Update `handleEnterpriseLogin`**

Replace `await startEnterpriseLogin()` with `await startEnterpriseSignIn()`.

- [ ] **Step 14.3: Update `handleEnterpriseCallback`**

Replace the body of the `try` block in `handleEnterpriseCallback`:

```ts
try {
  await signInWithEnterprise(url)
  router.push('/dm')
}
```

(Remove `await completeEnterpriseLogin(url)`, `bindClientEvents()`, `startSync()` — `signInWithEnterprise` does all of them.)

- [ ] **Step 14.4: Update password login handler**

Find the `login(...)` call in the file's password-login handler. Replace it with `signInWithPassword(serverUrl, { username, password })` and remove the subsequent `bindClientEvents()` / `startSync()` calls if present.

- [ ] **Step 14.5: Run tests and type-check**

Run: `pnpm test:unit --run`
Run: `pnpm type-check`
Expected: Pass.

- [ ] **Step 14.6: Commit**

```bash
git add src/features/auth/components/LoginPage.vue
git commit -m "refactor(login): use lifecycle.signInWithEnterprise/signInWithPassword"
```

---

### Task 15: Sweep for any remaining stale imports

**Files:**
- Audit: all files

- [ ] **Step 15.1: Search for any remaining references to removed exports**

Run:
```bash
grep -rn "restoreSession\|completeEnterpriseLogin\|startEnterpriseLogin\|parseEnterpriseAuthCallback\|refreshEnterpriseSession\|maybeRefreshOnStartup\|from '@matrix/auth'\|matrix/auth'" src/ tests/ 2>&1 | grep -v 'src/auth/lifecycle\|src/enterprise/session\|src/matrix/auth.ts\|tests/unit/enterprise/session\|tests/unit/auth/lifecycle'
```

Expected output: empty, or only false positives.

For each match: replace with the lifecycle equivalent, or delete if dead.

- [ ] **Step 15.2: Search for old import of `login` from `@matrix/index`**

```bash
grep -rn "import.*\\blogin\\b.*from '@matrix" src/ tests/
```

If any remain, either rename to `loginWithPassword` (if they want the bare Matrix call) or route through `signInWithPassword`.

- [ ] **Step 15.3: Run full unit suite + type-check**

Run: `pnpm test:unit --run && pnpm type-check`
Expected: All pass.

- [ ] **Step 15.4: Commit if anything changed**

```bash
git add -p
git commit -m "refactor: sweep remaining stale auth imports"
```

(Skip if Step 15.1 and 15.2 found nothing.)

---

## Phase 7: Smoke test and final verification

### Task 16: Run the desktop app and verify the happy paths

- [ ] **Step 16.1: Run the API + desktop in dev**

Run: `pnpm dev`
Expected: Both processes start without errors.

- [ ] **Step 16.2: Smoke — fresh enterprise sign-in**

In the app:
1. From the login screen, click "Enterprise login".
2. Complete OAuth in browser; deep link returns to the app.
3. Verify you land on `/dm` and the message list loads.

If the flow breaks: capture the console error and the relevant Network tab response (the `/api/oauth/token` response should now include `muonSession.deviceName`).

- [ ] **Step 16.3: Smoke — cold restart**

Quit the app, reopen.
Expected: You stay signed in and arrive at `/dm` without going through login.

- [ ] **Step 16.4: Smoke — near-expiry refresh**

Manually edit `localStorage.muon_enterprise_session` in DevTools to set `expiresAt` to ~1 hour from now (within the 24h threshold), keep `refreshToken` valid. Restart the app.
Expected: On bootstrap, a `POST /api/oauth/refresh` fires, returns 200, the stored session is rotated, `deviceName` is preserved across the rotation, and you land on `/dm`.

- [ ] **Step 16.5: Smoke — revoked session**

Manually clear the `device_sessions` row for your current session on the API (or use the admin UI to revoke it). Restart the app.
Expected: Refresh returns 401 → stored `muon_enterprise_session` is cleared → you land on `/login`.

- [ ] **Step 16.6: Smoke — sign out**

Wire `signOut()` to a button if no UI yet exists (or call it from DevTools console). Expected: Matrix client tears down cleanly, both storage keys are empty, you land on `/login`.

- [ ] **Step 16.7: Smoke — password login (if still supported)**

Sign in with a Matrix-password account on a homeserver that allows password login.
Expected: Lands on `/dm`. On restart, restores.

If any smoke fails, root-cause and fix before continuing.

---

### Task 17: Update CONTEXT.md call-out for `signOut` and prune dead code

**Files:**
- Modify: `CONTEXT.md` (only if any term needs a tightened definition based on what surfaced during smoke testing)
- Audit: `src/matrix/auth.ts`

- [ ] **Step 17.1: Re-read `src/matrix/auth.ts`**

Confirm the slim file contains only: `loginWithPassword`, `register`, `restoreMatrixSession`, `activateMatrixSession`, `logoutMatrix`, `clearMatrixSessionStore`, plus the small `matrixSessionStore` / `bridgeSafeStorage` helpers. Line count should be ~120–150 (down from 447).

If anything remains that doesn't belong (e.g., a leftover constant), remove it.

- [ ] **Step 17.2: Verify `src/enterprise/session.ts` has zero `localStorage.*` direct calls**

```bash
grep -n "localStorage" src/enterprise/session.ts
```

Expected: empty. All storage goes through `muonStore` / `matrixStore` / `pkceStore`.

- [ ] **Step 17.3: Run the full check pipeline**

Run: `pnpm check`
Expected: lint + tests + build all pass.

- [ ] **Step 17.4: Commit any final cleanups**

```bash
git add -p
git commit -m "refactor: final cleanup after EnterpriseSession extraction"
```

(Skip if nothing to commit.)

---

## Done criteria

- `pnpm check` passes (lint + unit tests + build).
- `src/matrix/auth.ts` is ≤ ~150 lines and exports only MatrixSession concerns.
- `src/enterprise/session.ts` exists with `start`, `complete`, `refresh`, `restore`, `clear`, `defaultEnterpriseSessionDeps`, `isEnterpriseAuthConfigured`, `parseEnterpriseAuthCallback`.
- `src/auth/lifecycle.ts` is the single public surface for sign-in/out used by `App.vue` and `LoginPage.vue`.
- `muonSessionSchema` requires `deviceName`; both server endpoints emit it; desktop never writes a desktop-side `deviceName` literal anywhere (search: `grep -rn "deviceName: 'Muon Desktop'" src/` returns one match in `complete()` only, as the value sent to the server on first sign-in; or zero matches if the test required the user-provided device name to flow through earlier — verify in code review).
- Smoke tests in Task 16 pass.
- `CONTEXT.md` exists and lists the terms used throughout.

## Rollback note

If anything in Phases 4–6 goes badly: each phase ends in a commit, so a `git revert` of the offending phase's commits restores the previous shape. Phases 1–3 (contracts, storage helper, EnterpriseSession module) are purely additive and safe to keep even on rollback.
