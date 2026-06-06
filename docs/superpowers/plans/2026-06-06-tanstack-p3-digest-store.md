# P3.2 — digestStore → vue-query (entries) + vue-store (runtime/filter) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the Pinia `digestStore` into its server half (persisted `entries` → `@tanstack/vue-query`) and its client half (ephemeral runtime `sourceEvents` + UI `activeFilter` → `@tanstack/vue-store`), reusing the P3.1 mixed-split pattern and extending it to a store that also owns a Matrix runtime subscription and a persist-on-build mutation.

**Architecture:** `digestStore` mixes four kinds of state: (1) **server** `entries` (DigestEntry[], hydrated from Dexie via `repository.listDigestEntries()`, persisted via `saveDigestEntry`) → vue-query `digestKeys.entries()`; (2) **ephemeral runtime** `sourceEvents` (accumulated from `matrixEvents.on('room.message')`, never persisted) → vue-store; (3) **client UI** `activeFilter` → vue-store; (4) derived `session`/`loading` — **dropped** (no consumer reads them; the only component never binds them, no test asserts them). The away-window materialization (`buildDigestSession`) becomes a mutation: materialize from `sourceEvents` within `[windowStart, windowEnd]`, and **only when materialization is non-empty** persist each entry and `setQueryData`. Empty materialization writes nothing — which exactly reproduces the old merge-on-empty rule (preserve hydrated entries) without reading the prior cache.

**Ordering (the one genuinely novel bit):** the old `initializeDigest` was sequential — hydrate, then build — so the build saw hydrated entries. Under vue-query, an auto-fetching query would race the mutation's `setQueryData` (a late-resolving hydrate could clobber a fresh session). So the entries query is `enabled: false` and the panel's `onMounted` drives it explicitly: `startRuntimeSync()` → `await refetch()` (hydrate) → if offline, `await buildSession.mutateAsync(...)`. This guarantees hydrate-before-build, a single Dexie read per mount (matching the old store, which also re-hydrated on every mount), and no race.

**Tech Stack:** Vue 3 Composition API, `@tanstack/vue-query@5`, `@tanstack/vue-store@0.11`, Vitest + Vue Test Utils. `repository.listDigestEntries()` / `saveDigestEntry()` are Promise methods and `materializeOfflineDigest()` is sync, so no Effect unwinding is needed (the old `DesktopEffect`/`runDesktopEffect` wrappers are dropped).

**Reference precedent:** P3.1 migrated `qaStore` (the mixed-split reference): `queries/qaKeys.ts` → `queries/qaApi.ts` → `queries/useQaHistory.ts` + a vue-store holding only the client selection. Conventions live in `apps/desktop/src/shared/query/README.md` (cache-as-source-of-truth, `setQueryData` over invalidate; mixed-store split). Reference three-layer split: `queries/{decisionKeys,decisionCardsApi,useDecisionCards}.ts` (P2).

---

## File Structure

| File | Responsibility |
| --- | --- |
| Create `apps/desktop/src/features/chat/queries/digestKeys.ts` | Query-key factory (`digestKeys.all` / `digestKeys.entries()`). |
| Create `apps/desktop/src/features/chat/queries/digestApi.ts` | Vue-free data layer: `loadDigestEntries`, `materializeDigestSession`, `persistDigestEntries`, `buildDigestSession`, pure helper `selectVisibleDigestEntries`. |
| Create `apps/desktop/src/features/chat/queries/useDigest.ts` | Composables: `useDigestEntriesQuery` (manual, `enabled: false`), `useBuildDigestSession`. |
| Rewrite `apps/desktop/src/features/chat/stores/digestStore.ts` | Pinia → native vue-store holding `{ sourceEvents, activeFilter }`; `ingestEvent`, `setFilter`, `startRuntimeSync`, `stopRuntimeSync`, `resetDigestStore`. |
| Modify `apps/desktop/src/features/chat/components/OfflineDigestPanel.vue` | Consume the query composables + selection/runtime store; orchestrate hydrate-before-build in `onMounted`. |
| Create `apps/desktop/tests/unit/queries/digestApi.test.ts` | Data-layer tests. |
| Rewrite `apps/desktop/tests/unit/stores/digestStore.test.ts` | Client vue-store tests (ingest dedupe, filter, runtime subscribe/ingest/idempotent/stop, reset). |
| Rewrite `apps/desktop/tests/components/OfflineDigestPanel.test.ts` | Mount with `VueQueryPlugin` + reset the vue-store; hydrate-preserve, build-from-ingested, citation nav. |

Old `digestStore.test.ts` cases map: "hydrates before refreshing" / "materializes responsibility>follow>mention" → `digestApi.test.ts` (`loadDigestEntries` sort + `buildDigestSession` persist) and the component build test; "subscribes to room.message" → `digestStore.test.ts`; "preserves hydrated when sourceEvents empty" → `digestApi` (build returns `[]` → no write) + component hydrate-preserve test.

---

## Task 1: Query layer (`digestKeys.ts` + `digestApi.ts`)

**Files:** Create `queries/digestKeys.ts`, `queries/digestApi.ts`; Test `tests/unit/queries/digestApi.test.ts`.

- [ ] **Step 1: Write the failing test** — cover `loadDigestEntries` sort (compareDigestEntries), `selectVisibleDigestEntries` ('all' + relevance filter + eventId mapping), `materializeDigestSession` (sessionId/window passthrough, mock `@/matrix/digest`), `buildDigestSession` (non-empty → persists each + returns; empty → no persist + returns `[]`).
- [ ] **Step 2: Run, verify red** — `pnpm --filter @muon/desktop test:unit -- digestApi` → FAIL (module missing).
- [ ] **Step 3: Create `digestKeys.ts`** — `{ all: ['digest'], entries: () => [...all, 'entries'] }`.
- [ ] **Step 4: Implement `digestApi.ts`** — module-level `repository`; `loadDigestEntries` (sort), `materializeDigestSession` (format sessionId, call `materializeOfflineDigest`), `persistDigestEntries` (Promise.all save), `buildDigestSession` (materialize → persist-if-nonempty → return entries), `selectVisibleDigestEntries` (filter + sort + map eventId).
- [ ] **Step 5: Run, verify green.**
- [ ] **Step 6: Commit** — `feat(query): add digest query key factory and data layer`.

## Task 2: Composables (`useDigest.ts`)

**Files:** Create `queries/useDigest.ts`. Thin wrappers; verified end-to-end by Task 3's component test.

- [ ] **Step 1: Implement** `useDigestEntriesQuery` (`enabled: false`, `entries` computed) + `useBuildDigestSession` (mutationFn → `buildDigestSession`; onSuccess writes cache only when `entries.length > 0`).
- [ ] **Step 2: Type-check.**
- [ ] **Step 3: Commit** — `feat(query): add digest entries query + build-session mutation composables`.

## Task 3: Client vue-store + component migration + tests

Swap the store and component together (the panel is the store's only consumer) so the tree stays type-clean.

**Files:** Rewrite `stores/digestStore.ts`; Modify `components/OfflineDigestPanel.vue`; Rewrite `tests/unit/stores/digestStore.test.ts`; Rewrite `tests/components/OfflineDigestPanel.test.ts`.

- [ ] **Step 1: Rewrite the store** — `Store<{ sourceEvents, activeFilter }>`; `ingestEvent` (dedupe by eventId), `setFilter`, module-level `runtimeHandler` + `startRuntimeSync`/`stopRuntimeSync` (validate then `ingestEvent`), `resetDigestStore` (stop sync + reset state).
- [ ] **Step 2: Rewrite the store unit test** + run.
- [ ] **Step 3: Migrate the component** — consume `useDigestEntriesQuery`/`useBuildDigestSession`/`useSelector(digestStore, activeFilter)`; `entries = selectVisibleDigestEntries(query.entries, activeFilter)`; `onMounted` hydrate-before-build; template `activeFilter`/`setFilter`.
- [ ] **Step 4: Rewrite the component test** — `mountWithQuery` (VueQueryPlugin), reset store in beforeEach; hydrate-preserve, build-from-ingested-source-events, labels, citation nav, remount, preload-failure.
- [ ] **Step 5: Full verification** — `test`, `type-check`, `build`, `lint` (each exit 0).
- [ ] **Step 6: Confirm no Pinia residue** — `grep -n 'defineStore\|useDigestStore' stores/digestStore.ts` empty; `grep -rn 'useDigestStore' src tests` empty. Commit `refactor(chat): split digestStore into vue-query entries + vue-store runtime/filter`.

---

## Self-Review Notes

- **Spec coverage:** old surface — `entries` (→ `digestKeys.entries()` query), `visibleEntries` (→ `selectVisibleDigestEntries`), `hydrateDigestEntries` (→ query `refetch`/`loadDigestEntries`), `buildDigestSession` (→ `useBuildDigestSession` + `buildDigestSession`), `initializeDigest` (→ panel `onMounted` orchestration), `ingestEvent`/`setFilter`/`startRuntimeSync`/`stopRuntimeSync` (→ vue-store fns). Dropped: `session`, `loading`, Effect variants (no consumer).
- **No dual source of truth:** persisted entries live only in the query cache; the vue-store holds only ephemeral `sourceEvents` (never persisted, rebuilt from live events) + the UI filter.
- **Merge-on-empty without reading the cache:** the build mutation writes the cache only when materialization is non-empty; empty leaves the hydrated cache untouched — same result as the old `if (empty && current>0) preserve` branch, with no ordering dependency for correctness.
- **Hydrate-before-build, no race:** `enabled: false` + `onMounted` `await refetch()` then `mutateAsync` guarantees the build's `setQueryData` lands after hydrate; one Dexie read per mount (matches the old always-hydrate-on-mount behavior).
- **Failures stay visible:** `loadDigestEntries`/`saveDigestEntry` reject on error (no catch-all); `materializeOfflineDigest` errors propagate through the mutation. The only swallow is the existing `preloadAndNavigate` warn-and-navigate fallback (unchanged).
- **Runtime subscription is a module singleton:** `startRuntimeSync` is idempotent and `resetDigestStore` unsubscribes, so tests don't leak handlers across the module-level singleton (the old Pinia per-test instance reset is replaced by `resetDigestStore`).
- **Blast radius:** `KnowledgeCapturePanel.integration.test.ts` stubs `OfflineDigestPanel`, so it's unaffected; `CrossSessionQaPanel.test.ts` already mounts the real panel (default digest tab) under `VueQueryPlugin` with `listDigestEntries → []` and a null `lastOfflineAt`, so behavior is unchanged.
