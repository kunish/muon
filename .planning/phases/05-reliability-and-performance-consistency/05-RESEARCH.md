# Phase 05: Reliability and Performance Consistency - Research

**Researched:** 2026-03-06
**Domain:** Matrix sync recovery, Vue rendering performance, inbox/search consistency
**Confidence:** MEDIUM

## User Constraints

- Must address **RELI-01** and **RELI-02**.
- Phase goal: 用户在重连恢复与日常高频使用中，收件箱与检索体验保持一致、无明显卡顿。
- Success criteria:
  1. 用户在断线重连或同步缺口恢复后，收件箱和任务状态保持一致且无静默丢项。
  2. 用户在执行收件箱处理与检索操作时，不会感知明显输入或导航延迟。
- Depends on Phase 4 patterns already in the repo: single-store orchestration, shared side-panel entry points, preload-then-fallback navigation, and action-owned state changes.
- No `CONTEXT.md` exists for this phase; research scope is constrained to roadmap, requirements, state, codebase evidence, and verified external docs.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RELI-01 | User sees consistent inbox/task state after reconnect or sync gap recovery without silent item loss. | Gap-aware sync handling, canonical recompute from Matrix room state, de-duplication by eventId, recovery tests for reconnect/limited timeline, and preservation of local task/defer state. |
| RELI-02 | User can complete inbox and search workflows without noticeable typing or navigation lag. | Stable shallow reactive collections, list virtualization for large inbox/search result sets, bounded non-blocking navigation preload, and performance-focused component tests. |
</phase_requirements>

## Summary

Phase 5 should be planned as a **recovery-and-rendering hardening phase**, not a feature phase. The repo already has good foundations: Matrix sync is centralized through `matrix-js-sdk`, inbox and conversations already use `shallowRef` plus debounced refresh, navigation already treats context preload as best-effort, and the conversation list already uses `@tanstack/vue-virtual`. The main gaps are that reconnect states are only partially modeled, sync recovery does not trigger a guaranteed canonical recompute, the room summary path still reads deprecated `room.timeline`, and inbox/global search lists are still rendered eagerly.

The most important planning direction is: **treat Matrix SDK room state as the canonical source after reconnect, then re-derive inbox/search-facing state from that canonical source in one place**. Do not try to preserve consistency by incrementally patching UI lists from transient event listeners alone. Pair that with virtualization / stable reactive updates for inbox and search surfaces so high-frequency usage does not turn correctness work into input lag.

**Primary recommendation:** add a dedicated recovery coordinator/store that reacts to Matrix sync recovery states, re-derives inbox/search state from canonical SDK room data, and applies virtualization/stable-reactivity patterns to inbox and global search lists.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `matrix-js-sdk` | `^41.0.0` | Canonical Matrix sync/search/timeline state | Official SDK already owns `/sync`, search pagination, room timelines, retry, and room models. |
| `vue` | `^3.5.29` | UI/reactivity | Official Vue perf guidance explicitly recommends stable props, computed stability, virtualization, and shallow reactivity for large immutable structures. |
| `pinia` | `^3.0.4` | Recovery and derived-state orchestration | Existing repo pattern centralizes mutations in store actions; Phase 5 should extend that, not bypass it. |
| `@tanstack/vue-virtual` | `^3.13.19` | Virtualized rendering for large inbox/search lists | Already used in `ConversationList.vue`, so it is the existing blessed virtualization stack. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dexie` | `^4.3.0` | Durable recovery metadata/checkpoints if Phase 5 needs IndexedDB persistence | Use for recovery cursors/journals or larger reliability metadata; do **not** migrate all localStorage state unless tests prove it necessary. |
| `@vue/test-utils` | `^2.4.6` | Component verification | Use for inbox/search recovery and render-budget tests. |
| `vitest` | `^4.0.18` | Unit/component validation | Fast guardrail for reconnect, gap recovery, and render-performance regressions. |
| `@playwright/test` | `^1.58.2` | End-to-end smoke validation | Use for one browser-level reconnect/navigation smoke once unit coverage exists. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `matrix-js-sdk` sync/search APIs | Hand-rolled REST `/sync` and `/search` clients | Not recommended; duplicates SDK responsibilities and increases gap/retry risk. |
| `@tanstack/vue-virtual` | Manual pagination / custom windowing | Avoid; virtualization is already in-repo and official Vue guidance says not to hand-roll large-list rendering. |
| Re-deriving from canonical room state | Incremental UI-only patching from emitted events | Incremental patching is cheaper initially but is fragile under reconnect, limited timelines, and timeline resets. |
| New global persistence migration | Keep existing localStorage for task/defer/processed ids and add targeted Dexie metadata | Recommended unless Phase 5 tests expose quota or consistency failures. |

**Installation:**
```bash
npm install matrix-js-sdk vue pinia @tanstack/vue-virtual dexie
```

## Architecture Patterns

### Recommended Project Structure
```text
src/
├── matrix/
│   ├── sync.ts              # sync state bridge + reconnect state handling
│   ├── rooms.ts             # canonical room summaries from SDK room models
│   └── recovery.ts          # NEW: gap/reconnect reconciliation helpers
├── features/chat/stores/
│   ├── inboxStore.ts        # processed/filter state only
│   ├── retrievalStore.ts    # search session + pagination state
│   └── reliabilityStore.ts  # NEW: orchestrates recovery + perf budgets
└── features/chat/components/
    ├── UnifiedInboxPanel.vue
    └── GlobalSearch.vue     # virtualized results, bounded navigation preload
```

### Pattern 1: Canonical Reconciliation on Sync Recovery
**What:** On reconnect-related sync states, run one bounded reconciliation pass that rebuilds inbox/search-facing derived data from current Matrix SDK room state plus existing local task/defer/processed state.

**When to use:** Any time sync transitions through `RECONNECTING`, `CATCHUP`, `PREPARED`, or returns to `SYNCING` after an error.

**Example:**
```typescript
// Source: https://matrix-org.github.io/matrix-js-sdk/enums/matrix.ClientEvent.html#sync
client.on('sync', (state, prevState) => {
  if (state === 'CATCHUP' || state === 'PREPARED') {
    void reliabilityStore.reconcileFromClient()
    return
  }

  if (prevState === 'ERROR' && state === 'SYNCING') {
    void reliabilityStore.reconcileFromClient()
  }
})
```

### Pattern 2: Replace-Root Updates for Large Derived Collections
**What:** Keep large room/inbox/search arrays in `shallowRef()` and update by replacing the root array, not mutating nested structures in place.

**When to use:** Any derived collection refreshed from Matrix SDK room summaries or search pages.

**Example:**
```typescript
// Source: https://vuejs.org/guide/best-practices/performance#reduce-reactivity-overhead-for-large-immutable-structures
const summaries = shallowRef<RoomSummary[]>([])

function applySummaries(next: RoomSummary[]) {
  summaries.value = next
}
```

### Pattern 3: Virtualize Inbox/Search Result Rendering
**What:** Use `@tanstack/vue-virtual` for result-heavy inbox/search lists instead of rendering every item.

**When to use:** `UnifiedInboxPanel` and `GlobalSearch` once result counts can grow with joined rooms or paginated search results.

**Example:**
```typescript
// Source: https://tanstack.com/virtual/v3/docs/framework/vue/vue-virtual
const virtualizer = useVirtualizer(computed(() => ({
  count: items.value.length,
  getScrollElement: () => scrollRef.value,
  estimateSize: () => 56,
  overscan: 6,
})))
```

### Pattern 4: Bounded, Non-Blocking Navigation Preload
**What:** Keep current “preload context, warn on failure, continue navigation” behavior, but add a timeout/budget so reliability work never makes navigation feel slower.

**When to use:** Inbox jump, task jump, search result jump, digest/decision/QA citation jump.

**Example:**
```typescript
// Source: existing repo pattern + Matrix context APIs
await Promise.race([
  loadInboxEventContext(roomId, eventId),
  timeout(250),
]).catch(() => undefined)

await router.push({ path: `/chat/${encodeURIComponent(roomId)}`, query: { focusEventId: eventId } })
```

### Anti-Patterns to Avoid
- **Listening for `sync.state` without emitting it:** `useUnifiedInbox()` and `useConversations()` subscribe to `sync.state`, but current code never emits it.
- **Ignoring `CATCHUP` / `RECONNECTING`:** official Matrix sync states include both; current `SyncState` type and `startSync()` logic ignore them.
- **Using deprecated `room.timeline` as the main summary source:** official SDK docs deprecate it; `getLiveTimeline().getEvents()` is the safer current API.
- **Eager rendering of large inbox/search lists:** correctness work will regress UX if lists stay unvirtualized.
- **Blocking navigation on context preload:** keep fallback navigation non-blocking.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Matrix sync loop and retry state machine | Custom `/sync` polling | `matrix-js-sdk` `startClient()`, sync events, retry hooks | SDK already models `PREPARED`, `SYNCING`, `ERROR`, `RECONNECTING`, `CATCHUP`, pagination, and room state. |
| Gap token semantics | Custom opaque token bookkeeping | Matrix `next_batch` / `prev_batch` flow and SDK pagination/search APIs | Matrix spec defines the token lifecycle; custom handling is easy to get wrong. |
| Large-list DOM windowing | Custom scroll math | `@tanstack/vue-virtual` | Existing project precedent and official Vue perf guidance favor virtualization. |
| IndexedDB transaction control | Raw IndexedDB orchestration | Dexie transactions | Dexie documents transaction/error pitfalls and is already in the repo. |
| Recovery correctness via UI deltas | Manual patch chains in components | Central reconcile action in store/service | UI deltas are fragile under reconnect and limited timelines. |

**Key insight:** in this phase, custom glue is acceptable; custom infrastructure is not. Reuse SDK/state/rendering primitives and add orchestration around them.

## Common Pitfalls

### Pitfall 1: Reconnect States Are Partially Modeled
**What goes wrong:** Recovery logic never runs when the SDK enters `RECONNECTING` or `CATCHUP`.
**Why it happens:** Current `SyncState` only includes `PREPARED | SYNCING | ERROR | STOPPED`, and `startSync()` switches on only those states.
**How to avoid:** Expand local sync-state modeling to include the full official sync lifecycle and route recovery through one coordinator.
**Warning signs:** UI only reacts to hard error/success, not “catching up”; reconnect produces stale inbox/search until a fresh message arrives.

### Pitfall 2: `sync.state` Subscribers Never Fire
**What goes wrong:** Inbox/conversation refresh logic misses reconnect-driven updates.
**Why it happens:** `useUnifiedInbox()` and `useConversations()` listen for `sync.state`, but no code emits that event.
**How to avoid:** Emit `matrixEvents.emit('sync.state', { state })` from the sync bridge and treat it as a reconciliation trigger, not a cosmetic signal.
**Warning signs:** Event listeners exist in composables, but grep shows no emitter.

### Pitfall 3: Timeline Gaps Cause Silent Drift
**What goes wrong:** After a limited `/sync`, derived inbox state may be computed from incomplete timeline assumptions.
**Why it happens:** Matrix spec allows `limited` timelines and explicit gaps; clients must reconcile gaps using `prev_batch` / `/rooms/{roomId}/messages`, and duplicates can appear across APIs.
**How to avoid:** Reconcile after recovery, de-duplicate by `eventId`, and verify gap scenarios in tests. If canonical SDK room state is insufficient for a failing scenario, add explicit gap backfill as a targeted follow-up.
**Warning signs:** Missing inbox categories after reconnect, duplicate hits after search/pagination, or state changes appearing without expected timeline continuity.

### Pitfall 4: Deprecated Timeline Access Makes Recovery More Fragile
**What goes wrong:** Summary derivation reads a stale or reset-prone timeline reference.
**Why it happens:** `getRoomSummaries()` currently walks `room.timeline`, but official SDK docs deprecate that property and warn that the live timeline can change when a gap occurs.
**How to avoid:** Use `room.getLiveTimeline().getEvents()` or other official room APIs for summary derivation.
**Warning signs:** Gap-related bugs appear only after reconnect / limited sync, not on steady-state live traffic.

### Pitfall 5: Reliability Fixes Introduce Input Lag
**What goes wrong:** Inbox/search become correct but feel slower.
**Why it happens:** Eager rerenders, large computed lists, and unvirtualized results move too much work onto the main thread.
**How to avoid:** Use shallow collections, root replacement, virtualization, and bounded navigation preload.
**Warning signs:** Typing/searching gets worse as joined-room count or search result count grows.

## Code Examples

Verified patterns from official sources:

### Sync Recovery Trigger
```typescript
// Source: https://matrix-org.github.io/matrix-js-sdk/enums/matrix.ClientEvent.html#sync
client.on('sync', (state) => {
  if (state === 'CATCHUP' || state === 'PREPARED' || state === 'SYNCING') {
    void reconcileFromClient()
  }
})
```

### Gap-Aware Deduplication Rule
```typescript
// Source: https://spec.matrix.org/v1.17/client-server-api/#get_matrixclientv3sync
const seenEventIds = new Set<string>()

function appendUnique<T extends { eventId: string }>(items: T[], next: T[]) {
  for (const item of next) {
    if (seenEventIds.has(item.eventId))
      continue
    seenEventIds.add(item.eventId)
    items.push(item)
  }
}
```

### Virtualized Results
```typescript
// Source: https://tanstack.com/virtual/v3/docs/framework/vue/vue-virtual
const virtualizer = useVirtualizer(computed(() => ({
  count: results.value.length,
  getScrollElement: () => scrollRef.value,
  estimateSize: () => 64,
  overscan: 8,
})))
```

### Shallow Immutable Collection Update
```typescript
// Source: https://vuejs.org/guide/best-practices/performance#reduce-reactivity-overhead-for-large-immutable-structures
const list = shallowRef<ResultItem[]>([])

function replaceResultAt(index: number, next: ResultItem) {
  list.value = [
    ...list.value.slice(0, index),
    next,
    ...list.value.slice(index + 1),
  ]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Treat sync as `PREPARED/SYNCING/ERROR/STOPPED` only | Respect full Matrix sync lifecycle including `RECONNECTING` and `CATCHUP` | Current official `matrix-js-sdk` ClientEvent docs | Recovery planning must model catch-up explicitly. |
| Read `room.timeline` directly | Prefer `room.getLiveTimeline().getEvents()` | Current `matrix-js-sdk` Room docs | Safer against live-timeline resets during gaps. |
| Render full large result lists | Virtualize long lists | Current Vue perf guidance + existing repo precedent | Reduces typing/navigation lag risk. |
| Deep reactive large arrays by default | `shallowRef` + replace-root updates | Vue 3 current perf guidance | Lower main-thread/reactivity overhead during frequent refreshes. |

**Deprecated/outdated:**
- `room.timeline`: deprecated in official SDK docs; use `getLiveTimeline().getEvents()` instead.
- “Retry immediately on any sync error” as an automatic loop: official SDK docs say `retryImmediately()` is for explicit user retry; Phase 5 should not depend on repeatedly forcing it from app code.

## Open Questions

1. **Is canonical room-summary recompute sufficient for RELI-01, or do some inbox heuristics need explicit gap backfill?**
   - What we know: Matrix spec allows limited timelines and requires clients to handle gaps; current inbox logic is room-summary-based, not event-ledger-based.
   - What's unclear: whether room-level `highlightCount/unread/latest event` is enough for all reconnect cases the product cares about.
   - Recommendation: plan Wave 1 around canonical recompute first; keep one targeted gap-backfill task ready if tests expose a missed inbox case.

2. **Does Phase 5 need Dexie for new recovery metadata, or can it stay in memory/localStorage?**
   - What we know: existing task/defer/inbox processed state already persists in versioned localStorage; Dexie already exists in repo.
   - What's unclear: whether recovery checkpoints or performance budgets need durable storage across restarts.
   - Recommendation: do not migrate existing stores by default; add Dexie only for new recovery metadata if a concrete requirement/test needs it.

3. **Should search remain submit-driven or become incremental?**
   - What we know: current `GlobalSearch.vue` submits explicitly and filters room names on every keystroke locally.
   - What's unclear: whether RELI-02 only needs render hardening, or also needs a more responsive incremental search UX.
   - Recommendation: plan for virtualization and bounded rendering first; treat search-on-type as out of scope unless product explicitly asks for it.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.0.18` + Vue Test Utils `^2.4.6`; Playwright `^1.58.2` for browser smoke |
| Config file | `vitest.config.ts`, `playwright.config.ts` |
| Quick run command | `pnpm vitest run tests/unit/matrix/syncRecovery.test.ts tests/components/UnifiedInboxPanel.recovery.test.ts tests/components/GlobalSearch.performance.test.ts` |
| Full suite command | `pnpm test:unit && pnpm test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RELI-01 | Reconnect / limited-sync recovery re-derives inbox + preserves task state without silent loss | unit + component integration | `pnpm vitest run tests/unit/matrix/syncRecovery.test.ts tests/components/UnifiedInboxPanel.recovery.test.ts tests/unit/stores/taskStore.recovery.test.ts -x` | ❌ Wave 0 |
| RELI-02 | Inbox/search interactions stay responsive under larger result sets and navigation preload remains bounded | component perf + smoke | `pnpm vitest run tests/components/UnifiedInboxPanel.performance.test.ts tests/components/GlobalSearch.performance.test.ts -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run tests/unit/matrix/syncRecovery.test.ts tests/components/UnifiedInboxPanel.recovery.test.ts tests/components/GlobalSearch.performance.test.ts`
- **Per wave merge:** `pnpm test:unit`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/matrix/syncRecovery.test.ts` — covers RELI-01 sync-state transitions, gap dedupe, and recovery trigger wiring.
- [ ] `tests/components/UnifiedInboxPanel.recovery.test.ts` — covers reconnect/gap-driven inbox consistency.
- [ ] `tests/unit/stores/taskStore.recovery.test.ts` — covers task persistence continuity through reconnect/bootstrap.
- [ ] `tests/components/UnifiedInboxPanel.performance.test.ts` — covers large-list rendering budget / virtualization behavior.
- [ ] `tests/components/GlobalSearch.performance.test.ts` — covers result pagination/render budget and bounded navigation preload.
- [ ] Shared recovery mock helpers in `tests/mocks/` — need explicit sync-state / limited-timeline fixtures; current mocks only return `limited: false` sync responses.

## Sources

### Primary (HIGH confidence)
- Matrix Client-Server API v1.17 — `/sync` gap handling, `limited`, `prev_batch`, dedupe guidance, and search pagination/security: https://spec.matrix.org/v1.17/client-server-api/
- matrix-js-sdk `ClientEvent.Sync` docs — official sync state lifecycle including `RECONNECTING` and `CATCHUP`: https://matrix-org.github.io/matrix-js-sdk/enums/matrix.ClientEvent.html#sync
- matrix-js-sdk `Room` docs — live timeline can change on gaps; `timeline` accessor deprecated: https://matrix-org.github.io/matrix-js-sdk/classes/matrix.Room.html
- matrix-js-sdk `MatrixClient` docs — `startClient`, `searchRoomEvents`, `retryImmediately`: https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html
- Vue performance guide — shallow reactivity, virtualize large lists, stable computed/props: https://vuejs.org/guide/best-practices/performance
- TanStack Virtual Vue docs — `useVirtualizer` API: https://tanstack.com/virtual/v3/docs/framework/vue/vue-virtual
- Dexie best practices — transaction/error handling guidance: https://dexie.org/docs/Tutorial/Best-Practices

### Secondary (MEDIUM confidence)
- Existing repo code in `src/features/chat/composables/useConversations.ts` and `ConversationList.vue` — proves current project pattern is shallow refs + debounced refresh + virtualization.
- Existing repo code in `GlobalSearch.vue`, `UnifiedInboxPanel.vue`, `sync.ts`, `rooms.ts`, and `types.ts` — exposes current Phase 5 gaps directly.

### Tertiary (LOW confidence)
- `.planning/research/SUMMARY.md` and `.planning/research/PITFALLS.md` — useful historical direction, but not authoritative versus current code and official docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Current repo dependencies align with official docs and existing implementation patterns.
- Architecture: MEDIUM - Canonical recompute direction is strongly supported, but exact need for explicit gap backfill depends on Phase 5 tests.
- Pitfalls: HIGH - Several gaps are directly observable in current code and corroborated by official Matrix/Vue docs.

**Research date:** 2026-03-06
**Valid until:** 2026-04-05
