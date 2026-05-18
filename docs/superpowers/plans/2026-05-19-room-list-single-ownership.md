# RoomList Single Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse `useConversations` and `useUnifiedInbox`'s independent `RoomSummary` derivations into one matrix-module projection. Delete the 200ms TTL cache + `invalidateRoomSummariesCache` hack that exists only because two consumers re-walk the SDK in the same tick. View-specific UX policy (`historicalRoomOrder`) stays in the view that owns it.

**Architecture:**
- New module `src/matrix/projections/roomList.ts` owns `roomListSummaries: ShallowRef<RoomSummary[]>` and `roomListLoading: Ref<boolean>`. Internal `bind()` / `unbind()` wire `matrixEvents` subscriptions and a single 80ms-debounced refresh. The module registers itself via `registerSessionSubscriber({ onSignIn, onSignOut })` at top-level import (per ADR-0002), so the projection lifecycle is owned by the session, not by Vue component mount/unmount.
- `useConversations` and `useUnifiedInbox` no longer subscribe to `matrixEvents` for room-list refresh, no longer hold their own `summaries` ref, no longer manage debounce timers, no longer call `invalidateRoomSummariesCache`. They read `roomListSummaries` and apply their per-view derivation.
- `getRoomSummaries()` in `src/matrix/rooms.ts` loses its TTL cache. `invalidateRoomSummariesCache` is deleted entirely. One-shot callers (login seed, future digest) read fresh.

**Tech Stack:** TypeScript, Vue 3, mitt, Vitest. No new dependencies.

**Prerequisite:** Candidate #2's plan (`2026-05-17-lifecycle-events.md`) provides `registerSessionSubscriber`. Strictly recommended — without it the projection store needs a manual init/dispose path that the plan documents as a fallback in Step 1.2.

**Glossary updates:** None. `RoomSummary` is already in `CONTEXT.md`. The new module exposes `roomListSummaries` (an identifier, not a domain term).

**Locked design decisions:**
- **Q1 narrowed scope**: only `useConversations` + `useUnifiedInbox` consolidate. `serverStore` keeps its independent Spaces hierarchy derivation — it does not consume `getRoomSummaries`.
- **Q2 (a)**: projection lives in `src/matrix/projections/roomList.ts`. See `docs/adr/0005-room-list-projection-ownership.md`.
- **Q3 (i)**: `historicalRoomOrder` stays in `useConversations` as a view-layer UX overlay on top of the projection. See ADR-0005.
- **Q4**: bind/unbind via `registerSessionSubscriber` from candidate #2's lifecycle event seam. View composables become pure reactive consumers.

**Out of scope:**
- Migrating `serverStore`'s room-list-like state. It walks Spaces hierarchy, not joined rooms, and is independent.
- Reactivity for typing indicators or read receipts inside the projection. Those flow through `matrixEvents` directly to per-room consumers and don't belong in a list-level shape.
- Replacing `RoomSummary` itself — its fields are unchanged.

---

## File Map

### Create
- `src/matrix/projections/roomList.ts` — `roomListSummaries`, `roomListLoading`, internal `bind`/`unbind`, top-level `registerSessionSubscriber` registration.
- `tests/unit/matrix/projections/roomList.test.ts` — projection re-derives on the right `matrixEvents`, debounced once, cleared on `signOut`, reset on `signIn`.

### Modify
- `src/matrix/rooms.ts`
  - Remove the `cachedSummaries` / `cacheTimestamp` / `CACHE_TTL` block (lines ~67-80).
  - Remove the internal `invalidateRoomSummariesCache()` call at `:205`.
  - Remove the exported `invalidateRoomSummariesCache` function entirely.
  - `getRoomSummaries()` keeps its signature and behavior, sans cache. One-shot callers (the projection's initial seed, any future digest path) work as before.
- `src/matrix/index.ts`
  - Remove `invalidateRoomSummariesCache` from the public re-export.
  - Add `roomListSummaries`, `roomListLoading` re-exports from `./projections/roomList`.
- `src/features/chat/composables/useConversations.ts`
  - Delete the `summaries` derivation: `let listenersBound`, `LISTENED_EVENTS`, `refreshEventHandlers`, `refreshNow()`, `scheduleRefresh()`, `debounceTimer`, all `matrixEvents.on/off` calls. The `historicalRoomOrder` logic and the rendering computeds stay.
  - The `rooms` shallow ref becomes `computed(() => applyStableOrder(roomListSummaries.value, historicalRoomOrder))` (or equivalent — pick the shape that fits the existing computeds with minimal touch).
  - Delete `import { invalidateRoomSummariesCache } from '@matrix/index'`.
  - Delete the dead `resetConversationsListeners` export (already noted as dead code in candidate #2's plan — this plan removes it as part of #4's scope since #4 deletes the listenersBound shape entirely).
  - Keep `loadArchivedDms` / DM-archive logic — that is per-user state and was already migrated to lifecycle events in candidate #2. If #2 has not landed yet, leave the existing localStorage shape in place and let #2 fix it later.
- `src/features/chat/composables/useUnifiedInbox.ts`
  - Same shape. Delete `summaries` ref, `listenersBound`, `scheduleRefresh`, `refreshNow`, `debounceTimer`, `LISTENED_EVENTS`, `handleSyncState`, `RECOVERY_SYNC_STATES`, the `bind` closure, and the `resetUnifiedInboxListeners` / `__resetUnifiedInboxForTests` exports.
  - The `allItems` / `items` / `counts` computeds read `roomListSummaries` directly.
  - Delete `import { invalidateRoomSummariesCache, ... }`.
- `tests/unit/matrix/rooms.test.ts` (if it asserts cache behavior) — update.

### Verify (no changes expected)
- `src/features/server/stores/serverStore.ts` — out of scope, no edit.
- `src/matrix/projections/messages.ts` (from candidate #3) — independent, no edit.
- `useConversations` rendering computeds (`conversations`, `pinnedCount`, `totalUnreadCount`) — should keep working if their input ref is preserved.

---

## Steps

### Phase 1 — Build the projection store

- [ ] **1.1 — Create `src/matrix/projections/roomList.ts`**
  ```ts
  import { ref, shallowRef } from 'vue'
  import type { RoomSummary } from '@matrix/types'
  import { getRoomSummaries, matrixEvents } from '@matrix/index'
  import { registerSessionSubscriber } from '@/auth/lifecycleEvents'

  const LISTENED_EVENTS = [
    'room.message', 'room.timeline', 'room.decrypted',
    'room.member', 'sync.state', 'room.receipt',
  ] as const

  export const roomListSummaries = shallowRef<RoomSummary[]>([])
  export const roomListLoading = ref(true)

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function refreshNow() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    roomListSummaries.value = getRoomSummaries()
    roomListLoading.value = false
  }

  function scheduleRefresh() {
    if (debounceTimer) return
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      refreshNow()
    }, 80)
  }

  function handleSyncState({ state }: { state: string }) {
    // Force-fresh on recovery transitions (matches existing useUnifiedInbox behaviour).
    if (state === 'RECONNECTING' || state === 'CATCHUP' || state === 'PREPARED' || state === 'SYNCING') {
      refreshNow()
    } else {
      scheduleRefresh()
    }
  }

  function bind() {
    for (const evt of LISTENED_EVENTS) matrixEvents.on(evt, scheduleRefresh)
    matrixEvents.off('sync.state', scheduleRefresh) // ensure not double-subscribed
    matrixEvents.on('sync.state', handleSyncState)
  }

  function unbind() {
    for (const evt of LISTENED_EVENTS) matrixEvents.off(evt, scheduleRefresh)
    matrixEvents.off('sync.state', handleSyncState)
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }

  registerSessionSubscriber({
    onSignIn: () => { bind(); refreshNow() },
    onSignOut: () => { unbind(); roomListSummaries.value = []; roomListLoading.value = true },
  })

  /** Test-only: re-run module-level wiring after `__resetLifecycleEventsForTests()`. */
  export function __resetRoomListForTests() {
    unbind()
    roomListSummaries.value = []
    roomListLoading.value = true
  }
  ```
  - **Fallback path** (if candidate #2 has NOT landed when this plan runs): replace `registerSessionSubscriber(...)` with a top-level `bind(); refreshNow()` plus an exported `disposeRoomList()` that callers (lifecycle.signOut, tests) invoke manually. Mark this with a TODO referencing candidate #2.
- [ ] **1.2 — Re-export** `roomListSummaries`, `roomListLoading` from `src/matrix/index.ts`.
- [ ] **1.3 — Tests** in `tests/unit/matrix/projections/roomList.test.ts`:
  - On `signIn`, `roomListSummaries.value` populates from a stubbed `getRoomSummaries()`.
  - `matrixEvents.emit('room.message', ...)` triggers a debounced refresh; two emits in the same tick coalesce to one `getRoomSummaries()` call.
  - `matrixEvents.emit('sync.state', { state: 'PREPARED' })` triggers an immediate refresh (skipping debounce).
  - On `signOut`, `roomListSummaries.value === []` and subsequent `matrixEvents.emit` do not refresh.

**Checkpoint:** Module compiles, tests pass. No consumers yet — `useConversations` and `useUnifiedInbox` still own their own derivations.

### Phase 2 — Migrate `useConversations`

- [ ] **2.1 — Delete the room-list bind machinery**
  - Remove `LISTENED_EVENTS`, `REFRESH_EVENT_MODES`, `refreshEventHandlers`, `listenersBound`, `debounceTimer`, `pendingRefreshMode`, `scheduleRefresh`, `refreshNow`, the `onMounted(() => { listenersBound = ... })` block, and the dead `resetConversationsListeners` export.
- [ ] **2.2 — Replace `rooms.value` source**
  - `import { roomListSummaries } from '@matrix/index'`.
  - The `rooms` shallow ref is gone. The rendering computed that reads `rooms.value` now reads `applyStableOrder(roomListSummaries.value, historicalRoomOrder)` where `applyStableOrder` is the existing `preserveSummaryOrder` helper. Decide whether to keep it a computed or wrap in a watcher that updates `historicalRoomOrder` — see Step 2.3.
- [ ] **2.3 — Preserve `historicalRoomOrder` semantics**
  - The current code calls `updateHistoricalRoomOrder(next, mode)` inside `refreshNow()`. With the projection store driving updates, hook the same update via `watch(roomListSummaries, (next) => updateHistoricalRoomOrder(next, 'resort'), { immediate: true })`. The `RefreshMode` decision (resort vs preserve-order) was driven by the originating event; now it's lost. Mitigation: always `resort` on full refresh — the user-visible behavior is "list reorders when a message arrives," which is the `resort` path. The `preserve-order` path was for receipt / member / sync events that don't change ordering; with the consolidated projection, those still emit but `updateHistoricalRoomOrder` is idempotent for unchanged sequences. Verify with a manual test (Step 5.1).
  - If the loss of `RefreshMode` fidelity causes visible churn in testing, push `RefreshMode` back into the projection: expose `roomListSummaries` together with a `lastUpdateOrigin: Ref<'resort' | 'preserve-order'>` signal. Document this as an open question for Step 5 to settle.
- [ ] **2.4 — Verify computeds still work**
  - `conversations`, `pinnedCount`, `totalUnreadCount` all read what is now a derived ref. Make sure the reactive graph still triggers — `shallowRef` plus `watch` on it is fine; if you use `computed` reading `roomListSummaries.value`, that's also fine.

**Checkpoint:** Open the app, click around the conversation list. Send a message in another client; verify the list reorders. Verify pin/mute toggles still work. Verify no infinite refresh loops (the `historicalRoomOrder` update path is the main risk).

### Phase 3 — Migrate `useUnifiedInbox`

- [ ] **3.1 — Delete the room-list bind machinery**
  - Remove `summaries`, `isLoading`, `listenersBound`, `debounceTimer`, `LISTENED_EVENTS`, `RECOVERY_SYNC_STATES`, `scheduleRefresh`, `refreshNow`, `handleSyncState`, `bind`, the `onMounted` block, the `resetUnifiedInboxListeners` / `__resetUnifiedInboxForTests` exports.
- [ ] **3.2 — Read from the projection**
  - `import { roomListLoading, roomListSummaries } from '@matrix/index'`.
  - `allItems` becomes `computed(() => toInboxItems(roomListSummaries.value, currentUserId))`.
  - `isLoading` is re-exported from `roomListLoading` (or the composable returns it directly).
- [ ] **3.3 — `refresh()` becomes a no-op or thin wrapper**
  - The composable used to expose `refresh: refreshNow`. There is no per-view refresh anymore. Either drop the `refresh` field or alias it to a one-shot `getRoomSummaries()` read that bypasses the projection — useful in tests but otherwise unnecessary. Pick "drop unless a caller depends on it" — grep first.

**Checkpoint:** Inbox renders the same mention / priority-unread / reply-needed items. Receipts update via the projection's `room.receipt` subscription.

### Phase 4 — Delete the TTL cache and invalidation API

- [ ] **4.1 — Remove cache from `src/matrix/rooms.ts`**
  - Delete `cachedSummaries`, `cacheTimestamp`, `CACHE_TTL` declarations (lines ~67-69).
  - In `getRoomSummaries()`, remove the cache hit block (lines 77-80). Always compute.
  - Delete `invalidateRoomSummariesCache` (function definition and any internal call at `:205`).
- [ ] **4.2 — Remove from public surface**
  - `src/matrix/index.ts:62` — remove `invalidateRoomSummariesCache` from the re-export list.
- [ ] **4.3 — Grep for any remaining callers**
  - `grep -rEn 'invalidateRoomSummariesCache' src/` should return zero hits after Phases 2-3 strip out the call sites in the two composables.

**Checkpoint:** `pnpm typecheck` passes. `pnpm test` passes.

### Phase 5 — Verification

- [ ] **5.1 — Manual UX check on ordering churn**
  - Open the app, focus the conversation list, watch ordering as you trigger non-message events (read a receipt, a member joins another room). The current code uses `preserve-order` for those. Confirm the new code does NOT visibly shuffle when a non-message event arrives. If shuffle is visible, push `RefreshMode` into the projection (Step 2.3 contingency).
- [ ] **5.2 — Grep audit**
  - `grep -rEn 'listenersBound|debounceTimer' src/features/chat/composables/` returns zero hits (or only hits unrelated to room-list bind).
  - `grep -rEn 'invalidateRoomSummariesCache|cachedSummaries|CACHE_TTL' src/` returns zero hits.
  - `grep -rEn "matrixEvents\.(on|off).*'room\." src/features/` — `useConversations` and `useUnifiedInbox` should contribute zero hits; remaining hits belong to other composables (useMessages, useNotificationSound).
- [ ] **5.3 — Tests**
  - `pnpm test tests/unit/matrix/projections/roomList.test.ts`
  - Existing `useConversations` / `useUnifiedInbox` tests (if any) updated.
- [ ] **5.4 — Performance sanity**
  - With a 100-room sync replay, count `getRoomSummaries()` invocations during a one-second active-chat burst. Should drop to ~12 (80ms debounce) instead of the previous ~24 (two consumers × 12).

---

## Risk Notes

- **`RefreshMode` fidelity loss** (Step 2.3): the existing `useConversations` distinguishes `resort` events (message arrival → re-sort by lastMessageTs) from `preserve-order` events (receipt / member / sync-state → keep current order). Collapsing into one projection refresh removes that distinction. Two paths if shuffling becomes visible: (a) re-introduce `lastUpdateOrigin` signal on the projection, (b) compare summary identity in `useConversations` to decide whether to re-sort. (b) is cheaper to add later if needed; default to (a)-style simplicity first.
- **Module-level subscription before Pinia / Vue mount** (Step 1.1): `registerSessionSubscriber` is module-load-time. The `getRoomSummaries()` call inside `onSignIn` requires a live `getClient()`. If `signIn` is emitted from `lifecycle.activate()` AFTER the client is created and bound (per `2026-05-17-lifecycle-events.md` Step 2.1), this ordering is correct. Verify after #2 lands.
- **HMR**: per ADR-0002 risk note, top-level `registerSessionSubscriber` in `roomList.ts` re-registers on dev-mode HMR. The dispose pattern from candidate #2's plan applies here too. Add `if (import.meta.hot) import.meta.hot.dispose(...)` at module bottom.
- **One-shot non-reactive readers**: any future code that wants "the current room list, right now, even if a sign-in hasn't happened" should call `getRoomSummaries()` directly (still exported, just uncached). Document this affordance in the projection module's header comment.
- **Coupling to candidate #2**: this plan is best executed AFTER `2026-05-17-lifecycle-events.md` lands. Running them in parallel works (with the Step 1.1 fallback) but creates a temporary world where `roomList.ts` manages its own lifecycle and then gets switched over to the lifecycle subscriber when #2 ships. Pick a serialized order if possible.
