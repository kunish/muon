# TanStack Refactor — P0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the TanStack Query foundation (configured `QueryClient`, key-factory + queryFn conventions, isolated test client) and install the new TanStack libraries, without touching any existing Pinia store.

**Architecture:** Add `@tanstack/vue-store`, `@tanstack/vue-table`, `@tanstack/vue-form` to the catalog and the desktop/admin packages. Introduce `apps/desktop/src/shared/query/` as the home of the app `QueryClient` factory and the documented Query conventions, then wire that client into the existing `VueQueryPlugin` registration. Pinia and every store stay untouched so the app builds and ships unchanged at the end of this phase.

**Tech Stack:** Vue 3, `@tanstack/vue-query ^5`, `@tanstack/vue-store ^0.11`, `@tanstack/vue-table ^8.21`, `@tanstack/vue-form ^1.33`, Vitest, pnpm workspaces (catalog versioning).

**Spec:** `docs/superpowers/specs/2026-06-05-tanstack-suite-refactor-design.md` (P0 Foundation row).

---

## File Structure

Files created or modified in this phase:

- `pnpm-workspace.yaml` — add three catalog entries (`@tanstack/vue-store`, `@tanstack/vue-table`, `@tanstack/vue-form`).
- `apps/desktop/package.json` — add the three new libs as `catalog:` dependencies.
- `apps/admin/package.json` — add `@tanstack/vue-form` and `@tanstack/vue-table` as `catalog:` dependencies (admin owns the strongest form/table targets; it has no Pinia store, so it does not take `@tanstack/vue-store`).
- `apps/desktop/src/shared/query/queryClient.ts` — **create**. Single source of the app `QueryClient` config via a `createAppQueryClient()` factory.
- `apps/desktop/src/shared/query/README.md` — **create**. Documents the query-key factory pattern and the `effect` → `queryFn`/`mutationFn` unwinding convention that P1–P4 follow.
- `apps/desktop/tests/helpers/queryClient.ts` — **create**. `createTestQueryClient()` returning a retry-disabled, isolated client for deterministic tests.
- `apps/desktop/tests/unit/queryClient.test.ts` — **create**. Tests for the app client factory.
- `apps/desktop/tests/unit/testQueryClient.test.ts` — **create**. Tests for the test-client helper.
- `apps/desktop/src/app/plugins/index.ts` — **modify** (line 12). Register `VueQueryPlugin` with the configured client.

This phase introduces **no** store migration. The 22 Pinia stores and `tests/setup.ts` are untouched.

---

### Task 1: Install the new TanStack libraries

**Files:**
- Modify: `pnpm-workspace.yaml:24-25` (catalog block, alphabetical)
- Modify: `apps/desktop/package.json:64` (dependencies, alphabetical)
- Modify: `apps/admin/package.json` (dependencies, alphabetical)

- [ ] **Step 1: Add catalog entries**

In `pnpm-workspace.yaml`, the catalog already contains (lines 24–25):

```yaml
  '@tanstack/vue-query': '^5.100.6'
  '@tanstack/vue-virtual': '^3.13.24'
```

Add the three new entries so the `@tanstack/*` block reads (keep alphabetical order):

```yaml
  '@tanstack/vue-form': '^1.33.0'
  '@tanstack/vue-query': '^5.100.6'
  '@tanstack/vue-store': '^0.11.0'
  '@tanstack/vue-table': '^8.21.3'
  '@tanstack/vue-virtual': '^3.13.24'
```

- [ ] **Step 2: Add desktop dependencies**

In `apps/desktop/package.json`, the dependencies currently include (lines 64–65):

```json
    "@tanstack/vue-query": "catalog:",
    "@tanstack/vue-virtual": "catalog:",
```

Add the three new libs in alphabetical order so the block reads:

```json
    "@tanstack/vue-form": "catalog:",
    "@tanstack/vue-query": "catalog:",
    "@tanstack/vue-store": "catalog:",
    "@tanstack/vue-table": "catalog:",
    "@tanstack/vue-virtual": "catalog:",
```

- [ ] **Step 3: Add admin dependencies**

In `apps/admin/package.json` `dependencies`, add (alphabetical position, before `vue-router`):

```json
    "@tanstack/vue-form": "catalog:",
    "@tanstack/vue-table": "catalog:",
```

- [ ] **Step 4: Install**

Run: `pnpm install`
Expected: install succeeds; lockfile updates with the three new packages and no peer-dependency errors.

- [ ] **Step 5: Verify the packages resolve**

Run: `pnpm --filter @muon/desktop exec node -e "require.resolve('@tanstack/vue-store');require.resolve('@tanstack/vue-table');require.resolve('@tanstack/vue-form');console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 6: Commit**

```bash
git add pnpm-workspace.yaml apps/desktop/package.json apps/admin/package.json pnpm-lock.yaml
git commit -m "build(deps): add tanstack vue-store, vue-table, vue-form"
```

---

### Task 2: App QueryClient factory

**Files:**
- Create: `apps/desktop/src/shared/query/queryClient.ts`
- Test: `apps/desktop/tests/unit/queryClient.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/tests/unit/queryClient.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createAppQueryClient } from '@/shared/query/queryClient'

describe('createAppQueryClient', () => {
  it('configures conservative query and mutation defaults', () => {
    const defaults = createAppQueryClient().getDefaultOptions()
    expect(defaults.queries?.staleTime).toBe(60_000)
    expect(defaults.queries?.gcTime).toBe(300_000)
    expect(defaults.queries?.retry).toBe(1)
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false)
    expect(defaults.mutations?.retry).toBe(0)
  })

  it('returns a fresh client on each call', () => {
    expect(createAppQueryClient()).not.toBe(createAppQueryClient())
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @muon/desktop test:unit -- queryClient.test.ts`
Expected: FAIL — cannot resolve `@/shared/query/queryClient`.

- [ ] **Step 3: Write the minimal implementation**

Create `apps/desktop/src/shared/query/queryClient.ts`:

```ts
import { QueryClient } from '@tanstack/vue-query'

/**
 * Single source of truth for the renderer QueryClient configuration.
 *
 * The plugin layer and any code that needs an app-configured client both call
 * this factory, so query/mutation defaults never drift. Defaults are
 * deliberately conservative: short staleness, one retry, no refetch-on-focus
 * (the desktop app is long-lived and focus churn would over-fetch).
 */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 300_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @muon/desktop test:unit -- queryClient.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/shared/query/queryClient.ts apps/desktop/tests/unit/queryClient.test.ts
git commit -m "feat(query): add configured app QueryClient factory"
```

---

### Task 3: Isolated test QueryClient helper

**Files:**
- Create: `apps/desktop/tests/helpers/queryClient.ts`
- Test: `apps/desktop/tests/unit/testQueryClient.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/tests/unit/testQueryClient.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createTestQueryClient } from '../helpers/queryClient'

describe('createTestQueryClient', () => {
  it('disables retries and gc for deterministic tests', () => {
    const defaults = createTestQueryClient().getDefaultOptions()
    expect(defaults.queries?.retry).toBe(false)
    expect(defaults.queries?.gcTime).toBe(0)
    expect(defaults.mutations?.retry).toBe(false)
  })

  it('returns an isolated client on each call', () => {
    expect(createTestQueryClient()).not.toBe(createTestQueryClient())
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @muon/desktop test:unit -- testQueryClient.test.ts`
Expected: FAIL — cannot resolve `../helpers/queryClient`.

- [ ] **Step 3: Write the minimal implementation**

Create `apps/desktop/tests/helpers/queryClient.ts`:

```ts
import { QueryClient } from '@tanstack/vue-query'

/**
 * Per-test QueryClient. Retries are off so a failing queryFn surfaces
 * immediately instead of being retried, and gcTime is 0 so no cache leaks
 * across tests. Each call returns a fresh, isolated client — never share one
 * between tests. P2+ query tests mount components with this client.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @muon/desktop test:unit -- testQueryClient.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/tests/helpers/queryClient.ts apps/desktop/tests/unit/testQueryClient.test.ts
git commit -m "test(query): add isolated test QueryClient helper"
```

---

### Task 4: Wire the configured client into the plugin

**Files:**
- Modify: `apps/desktop/src/app/plugins/index.ts:2,12`

- [ ] **Step 1: Replace the bare VueQueryPlugin registration**

The file currently reads:

```ts
import type { App } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import router from '../router'
import { syncDesktopSettingsWithStore } from './desktopSettings'
import { i18n, syncI18nLocaleWithSettings } from './i18n'
import { pinia } from './pinia'

export function setupPlugins(app: App) {
  app.use(pinia)
  syncDesktopSettingsWithStore()
  syncI18nLocaleWithSettings()
  app.use(VueQueryPlugin)
  app.use(i18n)
  app.use(router)
}
```

Change the `@tanstack/vue-query` import to also pull in the factory, and pass the client to the plugin. After editing:

```ts
import type { App } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { createAppQueryClient } from '@/shared/query/queryClient'
import router from '../router'
import { syncDesktopSettingsWithStore } from './desktopSettings'
import { i18n, syncI18nLocaleWithSettings } from './i18n'
import { pinia } from './pinia'

export function setupPlugins(app: App) {
  app.use(pinia)
  syncDesktopSettingsWithStore()
  syncI18nLocaleWithSettings()
  app.use(VueQueryPlugin, { queryClient: createAppQueryClient() })
  app.use(i18n)
  app.use(router)
}
```

Leave the pinia registration and plugin order unchanged.

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @muon/desktop type-check`
Expected: PASS, no new errors.

- [ ] **Step 3: Build to confirm the app still assembles**

Run: `pnpm --filter @muon/desktop build:web`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/app/plugins/index.ts
git commit -m "feat(query): register VueQueryPlugin with configured client"
```

---

### Task 5: Document the Query conventions

**Files:**
- Create: `apps/desktop/src/shared/query/README.md`

- [ ] **Step 1: Write the conventions doc**

Create `apps/desktop/src/shared/query/README.md`. This is the contract P1–P4 follow when moving server state off Pinia:

````markdown
# Query conventions

Server state (anything sourced from Dexie/IndexedDB, matrix-js-sdk, or IPC)
lives in `@tanstack/vue-query`, not in a store.

## QueryClient

`createAppQueryClient()` in `queryClient.ts` is the only place query/mutation
defaults are configured. The plugin layer creates the singleton; tests use
`createTestQueryClient()` from `tests/helpers/queryClient.ts`.

## Query keys: one factory per feature

Never inline a string key. Each feature owns a `const` key factory colocated
with the feature (e.g. `features/chat/queries/chatKeys.ts`):

```ts
export const chatKeys = {
  all: ['chat'] as const,
  pinned: (roomId: string) => [...chatKeys.all, 'pinned', roomId] as const,
  muted: (roomId: string) => [...chatKeys.all, 'muted', roomId] as const,
}
```

Reads use `useQuery({ queryKey: chatKeys.pinned(roomId), queryFn })`. Writes use
`useMutation` and then `invalidateQueries({ queryKey: chatKeys.pinned(roomId) })`
(or `setQueryData` where an optimistic update already existed).

## Unwinding `effect` pipelines

Stores that wrapped async work in `effect` / `runDesktopSync` must expose a
plain `async` `queryFn`/`mutationFn`. Run the Effect to a Promise at the
boundary and let errors reject — do not swallow them. Retry/error behavior that
the Effect provided is reproduced via QueryClient `retry`/`onError`, not via a
catch-all.
````

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/shared/query/README.md
git commit -m "docs(query): document key-factory and queryFn conventions"
```

---

### Task 6: Phase verification

**Files:** none (verification only)

- [ ] **Step 1: Full desktop unit tests**

Run: `pnpm --filter @muon/desktop test:unit`
Expected: PASS, including the two new test files; no previously-passing test regresses.

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @muon/desktop type-check`
Expected: PASS.

- [ ] **Step 3: Build desktop and admin**

Run: `pnpm --filter @muon/desktop build:web && pnpm --filter @muon/admin build`
Expected: both succeed (admin now resolves the new TanStack deps).

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: PASS.

---

## Self-Review

- **Spec coverage:** This plan implements exactly the P0 Foundation row of the spec (add the 3 libs to catalog + desktop/admin; create `shared/query/queryClient.ts`; establish the key-factory convention; wire the configured `QueryClient` into `VueQueryPlugin`). Pinia is untouched, satisfying the spec's "Pinia untouched" P0 constraint. P1–P4 (store migrations, forms, tables, Pinia removal) are out of scope for this plan and get their own plans authored at the start of each phase, once each store's real implementation is read.
- **No placeholders:** every code step shows complete file contents or exact diffs; every run step has a command and expected result.
- **Type consistency:** `createAppQueryClient()` (Task 2) is the exact symbol imported in Task 4; `createTestQueryClient()` (Task 3) is referenced only by tests. The `@/shared/query/queryClient` alias matches the desktop Vite/Vitest `@` → `src` alias.
