# Session Lifecycle Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken "each store/composable owns its own dead `reset*()` function that nobody calls" pattern with a single lifecycle event seam. `lifecycle.activate()` and `lifecycle.deactivate()` fire `signIn` / `signOut` events; subscribing modules (`useConversations`, `useUnifiedInbox`, `serverStore`) register at module load and receive paired bind/unbind callbacks. As a concrete payoff, the `archivedDmIds` cross-user-pollution bug is fixed by giving `onSignIn` the active `MatrixSession`.

**Architecture:**
- New module `src/auth/lifecycleEvents.ts` exposes a mitt instance with two events (`signIn: { session: MatrixSession }`, `signOut: { reason: 'user-initiated' | 'enterprise-revoked' | 'app-shutdown' }`) and a high-level `registerSessionSubscriber({ onSignIn, onSignOut }): () => void` API that returns a single `dispose` cleaning up both.
- `lifecycle.activate(session)` (from candidate #1's plan) fires `signIn` AFTER successful client activation. `lifecycle.deactivate()` fires `signOut` **BEFORE** SDK teardown so subscribers can still read `getClient()` for flushes. See `docs/adr/0002-session-lifecycle-event-seam.md`.
- Subscribers register at top-of-module-load. Their `onSignIn` handler binds `matrixEvents.on(...)` subscriptions and seeds initial state from the session. Their `onSignOut` handler unbinds, clears module-level state.
- Existing `listenersBound` flags, `resetConversationsListeners`, `resetUnifiedInboxListeners`, `serverStore.resetStore`, `serverStore.startListening` / `stopListening` (called from `AppLayout`) are removed.
- `useConversations.archivedDmIds` becomes user-scoped: localStorage key changes from `muon_archived_dms` to `muon_archived_dms:${session.userId}`, loaded on `onSignIn`, cleared on `onSignOut`.

**Tech Stack:** TypeScript, Vue 3, mitt, Vitest. No new dependencies (mitt already used by `matrixEvents`).

**Prerequisite:** Candidate #1's plan (`2026-05-17-session-lifecycle-deepening.md`) must have landed at least through Phase 2, so that `activate()` and `deactivate()` exist as the single emit points. This plan integrates with them.

**Glossary (see `CONTEXT.md`):** **MatrixSession**, **SignIn**, **SignOut**. No new domain terms — `signIn` / `signOut` events are named after the existing lifecycle verbs.

**Locked design decisions:**
- **Q1 (a)**: emitter lives in dedicated `src/auth/lifecycleEvents.ts`, not extending `matrixEvents`.
- **Q2 (i)**: subscribers register at module load (top-level side effect). See ADR-0002.
- **Q3 BEFORE**: `signOut` fires before `deactivate()`. See ADR-0002.
- **Q4 (b+c)**: both events carry payloads — `signIn` includes the active `MatrixSession`; `signOut` includes a `reason` discriminator.
- **Q5 (b)**: subscription API is `registerSessionSubscriber({ onSignIn, onSignOut }): () => void` — paired, returns single dispose.

**Out of scope:**
- Per-user namespacing for other localStorage keys (e.g. `muon_archived_dms` is the only one this plan touches as a worked example; broader localStorage audit is a separate review).
- A `signOutComplete` event fired after SDK teardown. Add only if a future subscriber needs it (ADR-0002 explicitly notes this is the escape hatch).
- Removing `serverStore.startListening()` from `AppLayout.onMounted` — handled in Phase 4, but `serverStore.stopListening()` from `AppLayout.onUnmounted` is also removed there.

---

## File Map

### Create
- `src/auth/lifecycleEvents.ts` — emitter + `registerSessionSubscriber` API.
- `tests/unit/auth/lifecycleEvents.test.ts` — emit / subscribe / dispose; signOut fires before deactivate (assert via spy ordering).

### Modify
- `src/auth/lifecycle.ts`
  - Import `lifecycleEvents`.
  - After `activate(session)` in `signInWithPassword` / `signInWithEnterprise` / `signUpWithPassword` / `bootstrap`, emit `signIn: { session }`.
  - In `signOut()`, **before** `revokeMatrixSession()`, emit `signOut: { reason: 'user-initiated' }`.
  - Add a private helper `emitSignInFor(session: MatrixSession)` to avoid repeating the emit in four places. `signOut` keeps the emit inline because there's only one call site.
- `src/features/chat/composables/useUnifiedInbox.ts`
  - Delete `listenersBound` flag, the `bind` closure inside `useUnifiedInbox()`, and `resetUnifiedInboxListeners` / `__resetUnifiedInboxForTests` exports.
  - At top level, call `registerSessionSubscriber({ onSignIn, onSignOut })`. `onSignIn` binds the same `LISTENED_EVENTS` + `sync.state` subscriptions and runs `refreshNow()`. `onSignOut` unbinds, invalidates summary cache, resets `summaries.value` / `isLoading.value` / `debounceTimer`.
  - `useUnifiedInbox()` itself becomes purely the view composable — no bind logic, no `listenersBound` check. The `onMounted` block can stay if `refreshNow()` on first mount is still desired for routes that load after `signIn` fired.
  - For tests, export a `__lifecycleSubscriberForTests` (the dispose function or a manual trigger). Add a `beforeEach` that re-registers if a prior test disposed.
- `src/features/chat/composables/useConversations.ts`
  - Same shape: delete `listenersBound`, replace `onMounted` bind block with module-load `registerSessionSubscriber`. Move `loadArchivedDms()` / `saveArchivedDms()` into `onSignIn` (keyed by `session.userId`) and reset on `onSignOut`. The module-level `archivedDmIds` set is no longer eagerly populated at import.
  - Delete `resetConversationsListeners` export.
- `src/features/server/stores/serverStore.ts`
  - Delete `eventsListening` flag, `startListening`, `stopListening`, `resetStore`.
  - At top level (outside the `defineStore` body — see Step 3.3 for the wrinkle), call `registerSessionSubscriber({ onSignIn, onSignOut })`. `onSignIn` runs `loadServers()` + binds the three `matrixEvents` subscriptions; `onSignOut` unbinds them and resets state (`servers.value = []` etc.).
- `src/app/components/AppLayout.vue:104-113`
  - Delete `serverStore.startListening()` from `onMounted` and `serverStore.stopListening()` from `onUnmounted`. Lifecycle now drives this. Keep `serverStore.loadServers()` if needed for the route — actually drop it too because `onSignIn` does the load.

### Verify (no changes expected)
- `src/matrix/events.ts` — no change. `matrixEvents` keeps its existing typed surface.
- `src/auth/lifecycle.ts` other verbs (`startEnterpriseSignIn`) — unaffected.

---

## Steps

### Phase 1 — Build the lifecycle event seam

- [ ] **1.1 — Create `src/auth/lifecycleEvents.ts`**
  ```ts
  import type { MatrixSession } from '@muon/enterprise-contracts'
  import mitt from 'mitt'

  export type SignOutReason = 'user-initiated' | 'enterprise-revoked' | 'app-shutdown'

  type LifecycleEvents = {
    signIn: { session: MatrixSession }
    signOut: { reason: SignOutReason }
  }

  const bus = mitt<LifecycleEvents>()

  export function emitSignIn(session: MatrixSession): void {
    bus.emit('signIn', { session })
  }

  export function emitSignOut(reason: SignOutReason): void {
    bus.emit('signOut', { reason })
  }

  export interface SessionSubscriber {
    onSignIn?: (e: { session: MatrixSession }) => void
    onSignOut?: (e: { reason: SignOutReason }) => void
  }

  export function registerSessionSubscriber(sub: SessionSubscriber): () => void {
    if (sub.onSignIn) bus.on('signIn', sub.onSignIn)
    if (sub.onSignOut) bus.on('signOut', sub.onSignOut)
    return () => {
      if (sub.onSignIn) bus.off('signIn', sub.onSignIn)
      if (sub.onSignOut) bus.off('signOut', sub.onSignOut)
    }
  }

  /** Test-only: clear every listener. Vitest beforeEach should call this to keep tests isolated. */
  export function __resetLifecycleEventsForTests(): void {
    bus.all.clear()
  }
  ```
- [ ] **1.2 — Tests in `tests/unit/auth/lifecycleEvents.test.ts`**
  - `emitSignIn` reaches subscribed `onSignIn` with the session payload.
  - `emitSignOut` reaches subscribed `onSignOut` with the reason.
  - `dispose()` removes both handlers; subsequent emits don't fire them.
  - Two subscribers each get the event.

**Checkpoint:** Module compiles, tests pass. No production wiring yet.

### Phase 2 — Wire emits into the lifecycle module

- [ ] **2.1 — Emit `signIn` from `lifecycle.ts`**
  - After `await activate(session)` in `signInWithPassword`, `signInWithEnterprise`, `signUpWithPassword`, call `emitSignIn(session)`. Use a private helper:
    ```ts
    async function activateAndAnnounce(session: MatrixSession) {
      await activate(session)
      emitSignIn(session)
    }
    ```
    Then the four sign-in/up entry points all call `activateAndAnnounce(session)`.
  - In `bootstrap`, after `await deps.activate(matrixSession)` for both the enterprise and matrix-only branches, call `emitSignIn(matrixSession)`. (Alternative: have `defaultBootstrapDeps()` wrap `activate` with the announce — slightly more magic.)
- [ ] **2.2 — Emit `signOut` from `lifecycle.signOut`**
  - New shape:
    ```ts
    export async function signOut(reason: SignOutReason = 'user-initiated'): Promise<void> {
      emitSignOut(reason)
      await revokeMatrixSession()
      await deactivate()
      clearEnterprise(defaultEnterpriseSessionDeps())
    }
    ```
  - Note: `reason` parameter is optional, default `'user-initiated'`. Future callers (e.g., a future "MuonSession refresh got 401 mid-app" handler) pass `'enterprise-revoked'`.
- [ ] **2.3 — Smoke test from #1's existing `lifecycle.test.ts`**
  - Update assertions that observe sign-in/sign-out to also assert `lifecycleEvents` emissions in the right order.

**Checkpoint:** Nothing subscribes yet, so emits are no-ops. Existing behavior unchanged.

### Phase 3 — Migrate subscribers

- [ ] **3.1 — Migrate `useUnifiedInbox.ts`**
  - At top of file (after imports, before `useUnifiedInbox` export), call `registerSessionSubscriber({ onSignIn: handleSignIn, onSignOut: handleSignOut })`.
  - `handleSignIn({ session })`:
    1. `for (const evt of LISTENED_EVENTS) matrixEvents.on(evt, scheduleRefresh)`
    2. `matrixEvents.on('sync.state', handleSyncState)`
    3. `refreshNow()` (initial seed; can also be deferred until first mount, but doing it here gives an immediately-correct module state).
  - `handleSignOut()`:
    1. `for (const evt of LISTENED_EVENTS) matrixEvents.off(evt, scheduleRefresh)`
    2. `matrixEvents.off('sync.state', handleSyncState)`
    3. `invalidateRoomSummariesCache()`
    4. Reset `summaries.value = []`, `isLoading.value = true`, clear `debounceTimer`.
  - Delete: `listenersBound`, `bind` closure inside `useUnifiedInbox()`, `resetUnifiedInboxListeners`, `__resetUnifiedInboxForTests` exports.
  - The `useUnifiedInbox()` composable's `onMounted` / `getCurrentInstance()` block remains, but only does `refreshNow()` (not bind). Or remove entirely if `handleSignIn` already seeded `summaries`. Pick one based on whether the route can mount before `signIn` is fired (lazy-loaded route case).
- [ ] **3.2 — Migrate `useConversations.ts`**
  - Same pattern. `LISTENED_EVENTS` set is different but the shape is the same.
  - **Sub-fix**: relocate `loadArchivedDms()` / `saveArchivedDms()` to be userId-scoped:
    ```ts
    const ARCHIVED_KEY_PREFIX = 'muon_archived_dms:'
    function loadArchivedDms(userId: string): Set<string> { /* localStorage.getItem(`${PREFIX}${userId}`) */ }
    function saveArchivedDms(userId: string, ids: Set<string>) { /* localStorage.setItem(...) */ }
    let archivedDmIds: Set<string> = new Set()
    let currentUserId: string | null = null
    ```
  - In `handleSignIn({ session })`: `currentUserId = session.userId; archivedDmIds = loadArchivedDms(session.userId)`. In `handleSignOut`: `archivedDmIds = new Set(); currentUserId = null`.
  - Anywhere `archivedDmIds` is mutated, also call `saveArchivedDms(currentUserId!, archivedDmIds)`.
  - One-time migration: on first `handleSignIn` after this change, if `localStorage.getItem('muon_archived_dms')` exists, copy to the new userId-scoped key and remove the old. This preserves existing users' archived DMs on first launch only. Wrap in a `try/catch`.
  - Delete `resetConversationsListeners` export.
- [ ] **3.3 — Migrate `serverStore.ts`**
  - Wrinkle: Pinia stores are factories. `registerSessionSubscriber` cannot run inside `defineStore`'s setup (called on first `useServerStore()`, not on import). Two options:
    - (a) Put `registerSessionSubscriber` at module top level, capturing a lazy reference: `let storeInstance: ReturnType<typeof useServerStore> | null = null`. Inside the subscriber callbacks, do `storeInstance ??= useServerStore()` before touching state. This works because `useServerStore()` is idempotent and Pinia must be installed by the time `signIn` fires (it fires after Vue app mount + bootstrap).
    - (b) Move the `eventsListening` bind/unbind logic OUT of the store factory into module-scoped functions that operate on a closure-captured `pinia.servers` ref. More invasive.
  - Pick (a) — minimal blast radius.
  - Delete `startListening`, `stopListening`, `eventsListening`, `resetStore` from the store return shape and replace with module-level subscriber handlers that call the existing private `loadServers`, `loadChannelTree`, etc., through `storeInstance`.
- [ ] **3.4 — Update `AppLayout.vue:104-113`**
  - Delete the `serverStore.startListening()` / `stopListening()` calls. The `loadServers` call inside `onMounted` can also go — `onSignIn` does it. Keep `syncServerSelectionFromRoute()` in `onMounted` (route-specific, not lifecycle-specific).

**Checkpoint:** Hand test: cold start with no session, sign in via password, verify channel tree + conversations + inbox populate. Sign out, verify state visibly resets. Sign in as a different user, verify no cross-pollination (archived DMs from previous user gone).

### Phase 4 — Cleanup

- [ ] **4.1 — Grep for dead references**
  - `grep -rn 'listenersBound\|resetUnifiedInbox\|resetConversations\|resetStore\|eventsListening' src/` should return zero hits.
- [ ] **4.2 — Remove transitional test exports**
  - If any test relied on `__resetUnifiedInboxForTests`, migrate it to `__resetLifecycleEventsForTests()` plus a fresh `registerSessionSubscriber` per test.
- [ ] **4.3 — Lint + typecheck + test run**
  - `pnpm lint && pnpm typecheck && pnpm test`.

**Checkpoint:** All tests green, no dead reset functions left.

---

## Verification

After all phases:

- [ ] In a single process: sign in as user A, archive a DM, sign out, sign in as user B → user B does NOT see user A's archived DM hidden from their view.
- [ ] `grep -rn 'listenersBound' src/` returns no hits.
- [ ] `grep -rn 'resetStore\|resetConversationsListeners\|resetUnifiedInboxListeners' src/` returns no hits.
- [ ] Sign in / sign out cycle works end-to-end with the new event seam (manual test through LoginPage).
- [ ] Order check: in a test, register a subscriber whose `onSignOut` calls `getClient()`; assert it does not throw (because `deactivate()` hasn't run yet at emit time).

---

## Risk Notes

- **HMR in dev mode** can reload subscriber modules. Top-level `registerSessionSubscriber` would run again on reload, creating duplicate subscriptions. Mitigation: add `if (import.meta.hot) { import.meta.hot.dispose(dispose) }` at the top-level dispose return. Verify in dev with a sign-in/HMR/sign-out cycle.
- **Pinia setup ordering**: `serverStore` registers a subscriber at module load, but the callback calls `useServerStore()` lazily. If `signIn` fires before Pinia is installed (it shouldn't — Pinia install happens in `src/app/main.ts` before `App.vue` mounts and runs `bootstrap`), the lazy `storeInstance ??= useServerStore()` will throw. Add an assertion log in the lazy resolve path for dev mode.
- **One-time localStorage migration for `archivedDmIds`**: only triggers on a user's first sign-in after this change ships. If a user signs in as two different identities before that first sign-in (unlikely but possible), the migration runs once for the first user and is gone — the second user's "archived" state is empty. Acceptable; otherwise we'd need a sticky migration flag.
- **`signOut` BEFORE `deactivate`** means subscribers must not trigger SDK calls in their `onSignOut` that have async side effects on the SDK — those calls may race with `deactivate()`'s teardown. Today's handlers only do mitt off + ref reset, so safe. ADR-0002 documents the contract.
- **Test isolation**: every test that touches `lifecycleEvents` should `beforeEach(() => __resetLifecycleEventsForTests())` plus re-register the module's subscriber. Without this, prior-test subscribers leak between tests.
