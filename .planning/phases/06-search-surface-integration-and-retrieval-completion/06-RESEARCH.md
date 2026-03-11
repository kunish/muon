# Phase 6: Search Surface Integration and Retrieval Completion - Research

**Researched:** 2026-03-06
**Domain:** Vue chat search-surface integration, Matrix retrieval wiring, navigation continuity
**Confidence:** HIGH

## User Constraints

- No `CONTEXT.md` exists for this phase.
- Locked scope comes from roadmap/audit/codebase evidence:
  - Must close the production search-surface gap from the milestone audit.
  - Must satisfy `RETR-01`, `RETR-02`, and `RELI-02` in the _real_ chat entrypoint.
  - Must preserve the existing bounded preload jump contract instead of inventing a new navigation path.
  - Must re-validate authorization filtering at the reachable mount point, not only in isolated service/component tests.
- Out of scope:
  - Semantic/vector retrieval (`RETR-03`)
  - Digest/knowledge continuity gaps (Phase 7)
  - New standalone search route/page architecture unrelated to the existing chat search trigger

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                  | Research Support                                                                                                                                                                     |
| ------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RETR-01 | User can search messages across conversations by keyword and receive ranked results.         | Reuse `matrix/retrieval.ts` + `retrievalStore.ts`; wire the real header trigger to the cross-conversation search surface; preserve pagination and ranked hit rendering.              |
| RETR-02 | User only sees retrieval results from conversations they are currently authorized to access. | Keep joined-room filtering in both service and UI; add real-mount integration verification so reachable flow proves authorization.                                                   |
| RELI-02 | User can complete inbox and search workflows without noticeable typing or navigation lag.    | Preserve Phase 5 virtualization and 250ms bounded preload budget in the production-mounted search panel; avoid regressions from reintroducing room-scoped or non-virtualized search. |

</phase_requirements>

## Summary

Phase 6 is not a greenfield retrieval phase. The core retrieval service, Pinia session state, pagination dedupe, virtualization, and bounded preload navigation already exist in `matrix/retrieval.ts`, `retrievalStore.ts`, and `GlobalSearch.vue`. The real problem is integration: the user-facing chat header still opens a side-panel slot in `ChatWindow.vue`, but that slot mounts the old room-scoped `SearchMessages.vue`, and its `jumpTo` emit is not consumed. The milestone audit is therefore correct: the best retrieval implementation exists on disk but is not production-reachable.

The most important planning decision is to integrate retrieval through the **existing chat side-panel state machine**, not by leaving a split-brain between `SearchMessages.vue` and `GlobalSearch.vue`. However, `GlobalSearch.vue` is currently shaped as a teleported modal and keeps its query in local component state while results live in a Pinia store. A straight swap in `ChatWindow.vue` would leave an empty 320px side panel shell, create awkward overlay behavior, and risk stale results on reopen because `retrievalStore.resetState()` is never called anywhere.

There is a second integration trap: `GlobalSearch.vue` currently navigates via legacy `/chat/...` paths, while the canonical route is `/dm/...` and `/chat/:roomId?` is only a redirect. Vue Router redirect docs show that dynamic redirects should explicitly forward query when needed; the current redirect returns a plain string, so `focusEventId` is risky at the exact point this phase must guarantee jump-back continuity. The safe plan is to switch reachable search navigation to the canonical `/dm` target and verify the full chain under the real mount point.

**Primary recommendation:** Replace the reachable `SearchMessages` surface with a side-panel-native cross-conversation search panel that reuses `retrievalStore` + `matrix/retrieval`, resets session state intentionally on open/close, and navigates with canonical `/dm` + `focusEventId` after bounded preload.

## Standard Stack

### Core

| Library       | Version   | Purpose                                   | Why Standard                                                                                          |
| ------------- | --------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Vue           | `^3.5.29` | SFC UI composition                        | Existing app standard; all reachable chat surfaces already use Vue SFCs.                              |
| Pinia         | `^3.0.4`  | Search session state                      | `retrievalStore.ts` already owns query/results/loading/pagination lifecycle.                          |
| matrix-js-sdk | `^41.0.0` | Cross-room search + timeline/context APIs | Existing retrieval and bounded-jump chain already depend on it; official v41.0.0 released 2026-02-24. |
| vue-router    | `^5.0.3`  | Room navigation + `focusEventId` handoff  | Canonical room routing already lives here; jump continuity depends on query propagation.              |

### Supporting

| Library               | Version    | Purpose                                        | When to Use                                                      |
| --------------------- | ---------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| @tanstack/vue-virtual | `^3.13.19` | Virtualized rendering for heavy search results | Keep for reachable production search hits to preserve `RELI-02`. |
| @vue/test-utils       | `^2.4.6`   | Component/integration mounting                 | Use for ChatWindow-level real-mount integration coverage.        |
| Vitest                | `^4.0.18`  | Unit/component/performance regression tests    | Use for all Phase 6 automated guards.                            |
| Playwright            | `^1.58.2`  | Optional routed smoke/e2e validation           | Use only if planner wants one true router-level search smoke.    |

### Alternatives Considered

| Instead of                         | Could Use                         | Tradeoff                                                                                                |
| ---------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `SearchMessages.vue`               | `GlobalSearch.vue` retrieval flow | Recommended: old surface is room-scoped and unwired; new flow already satisfies retrieval requirements. |
| Inline custom large-list rendering | `@tanstack/vue-virtual`           | Recommended: existing performance work already standardized on TanStack Virtual.                        |
| Legacy `/chat/:roomId` pushes      | Canonical `/dm/:roomId` pushes    | Recommended: avoids redirect ambiguity for `focusEventId` continuity.                                   |

**Installation:**

```bash
pnpm install
```

## Architecture Patterns

### Recommended Project Structure

```text
src/
├── features/chat/components/
│   ├── ChatHeader.vue              # existing reachable trigger
│   ├── ChatWindow.vue              # real side-panel mount point
│   ├── GlobalSearch.vue            # retrieval UI logic to reuse/refactor
│   └── SearchMessages.vue          # legacy room-scoped surface to replace/remove
├── features/chat/stores/
│   └── retrievalStore.ts           # single source of truth for result session
├── matrix/
│   ├── retrieval.ts                # joined-room scoped Matrix search service
│   └── inbox.ts                    # bounded preload context loader
└── app/router/
    └── index.ts                    # canonical `/dm` routes; legacy `/chat` redirect

tests/
├── components/
│   ├── GlobalSearch.test.ts
│   ├── GlobalSearch.performance.test.ts
│   └── ChatWindow.search.integration.test.ts   # add in Phase 6
└── unit/matrix/
    └── retrieval.test.ts
```

### Pattern 1: One reachable search surface only

**What:** The chat header trigger and the production search panel must terminate in the same retrieval implementation.
**When to use:** Immediately; this phase exists to remove split-brain search behavior.
**Example:**

```ts
// Source: codebase evidence
// ChatHeader.vue
@click="store.toggleSidePanel('search')"

// ChatWindow.vue (current broken mount)
<SearchMessages
  v-if="store.activeSidePanel === 'search' && store.currentRoomId"
  :room-id="store.currentRoomId"
  @close="store.closeSidePanel()"
/>
```

### Pattern 2: Retrieval service/store stays canonical

**What:** Keep authorization scope, pagination session, and dedupe in service/store; do not re-implement them in the component.
**When to use:** For every search submit/load-more path.
**Example:**

```ts
// Source: src/matrix/retrieval.ts
const joinedRoomIds: string[] = (client.getRooms?.() ?? [])
  .filter((room: any) => room.getMyMembership?.() === 'join')
  .map((room: any) => room.roomId)

const searchResults = await client.searchRoomEvents({
  term: normalizedTerm,
  filter: { rooms: joinedRoomIds, limit },
})
```

### Pattern 3: Reuse the existing bounded preload jump chain

**What:** Search result click should keep `loadInboxEventContext()` + `focusEventId` + non-blocking timeout semantics.
**When to use:** Any reachable message-result jump.
**Example:**

```ts
// Source pattern: src/features/chat/components/TaskPanel.vue + GlobalSearch.vue
await Promise.race([
  loadInboxEventContext(roomId, eventId).catch(() => 'failed' as const),
  timeoutAfter(250),
])

await router.push({
  path: `/dm/${encodeURIComponent(roomId)}`,
  query: { focusEventId: eventId },
})
```

### Pattern 4: Keep the panel shell aligned with the real mount point

**What:** Reachable search UI should render naturally inside the `ChatWindow` side-panel slot; if you want reusable search internals, split shell vs content instead of keeping a Teleport-only root.
**When to use:** When refactoring `GlobalSearch.vue` for production wiring.

### Anti-Patterns to Avoid

- **Keeping both `SearchMessages` and `GlobalSearch` reachable:** guarantees future drift and repeats the audit failure.
- **Straight-swapping teleported `GlobalSearch` into the side-panel slot:** leaves the empty 320px panel shell visible and couples side-panel state to overlay UI.
- **Navigating search hits through legacy `/chat/...`:** unnecessary redirect hop on a requirement-critical jump path.
- **Local query state + global result state without reset policy:** causes stale results on reopen.
- **Verifying only `GlobalSearch` in isolation:** misses the real `ChatHeader -> ChatWindow` mount contract that is currently broken.

## Don't Hand-Roll

| Problem                           | Don't Build                             | Use Instead                                         | Why                                                                                     |
| --------------------------------- | --------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Cross-session authorization scope | Ad-hoc room filtering in the panel only | `matrix/retrieval.ts` joined-room filter + UI guard | Service and UI already provide defense-in-depth for `RETR-02`.                          |
| Search pagination session         | Custom cursors in component refs        | `retrievalStore` + `RetrievalSession`               | Existing store already dedupes by `eventId` and preserves append-on-load-more behavior. |
| Large-result rendering            | Manual windowing logic                  | `@tanstack/vue-virtual`                             | Existing Phase 5 performance work already standardized and tested it.                   |
| Message jump context preload      | New REST fetch chain                    | `loadInboxEventContext()`                           | Existing chain already handles timeline-first + fallback context loading.               |
| Search panel state machine        | New modal/page-specific state store     | `chatStore.activeSidePanel`                         | Existing app convention keeps one side-panel coordinator.                               |

**Key insight:** Phase 6 should mostly remove integration debt, not invent new retrieval infrastructure.

## Common Pitfalls

### Pitfall 1: Split-brain search remains after “integration”

**What goes wrong:** Header trigger still reaches legacy room-scoped behavior while the advanced retrieval panel exists elsewhere.
**Why it happens:** `ChatWindow.vue` currently mounts `SearchMessages.vue` and only wires `@close`.
**How to avoid:** Treat `ChatWindow` as the source-of-truth mount point; replace or fully retire `SearchMessages.vue` from the reachable path.
**Warning signs:** Search works in isolated component tests but not from the header button.

### Pitfall 2: `focusEventId` continuity is lost through legacy redirect

**What goes wrong:** Search jump lands in the room but does not focus the target event.
**Why it happens:** `GlobalSearch.vue` pushes `/chat/...`, while router canonicalizes to `/dm/...`; Vue Router redirect docs show dynamic redirects should explicitly forward query when needed.
**How to avoid:** Push canonical `/dm/:roomId` directly for search result navigation.
**Warning signs:** Unit/component tests mock `router.push` and pass, but routed/manual validation loses focus on real navigation.

### Pitfall 3: Stale search session on reopen

**What goes wrong:** Reopening search shows old results with a blank input, or carries pagination state unexpectedly.
**Why it happens:** `GlobalSearch.vue` stores `query` locally, while `retrievalStore` persists results/session globally and `resetState()` has no callers.
**How to avoid:** Make reopen behavior explicit: either hydrate both query/results together or reset both on open/close. Recommended for this phase: reset on close/open to match the old panel’s fresh-session feel.
**Warning signs:** Search panel opens with message hits before the user submits a new query.

### Pitfall 4: Teleport/side-panel shell mismatch

**What goes wrong:** A blank 320px side panel remains visible while the search UI appears as an overlay elsewhere.
**Why it happens:** `GlobalSearch.vue` is rooted in `<Teleport to="body">`, while `ChatWindow.vue` expects inline side-panel children.
**How to avoid:** Extract reusable search content and provide a side-panel-native shell, or refactor `GlobalSearch.vue` itself to support embedded mode.
**Warning signs:** Search appears offset from the chat layout or the side panel reserves space with no visible content.

### Pitfall 5: Virtualizer regressions in test environments

**What goes wrong:** Search renders zero rows in jsdom or tests become flaky after refactor.
**Why it happens:** Phase 5 already found that `useVirtualizer` needs measured scroll containers.
**How to avoid:** Preserve the existing bounded fallback slice pattern when refactoring the panel.
**Warning signs:** `GlobalSearch.performance.test.ts` or new integration tests intermittently render no results.

## Code Examples

Verified project patterns:

### Authorization-bounded Matrix search request

```ts
// Source: src/matrix/retrieval.ts
const joinedRoomIds: string[] = (client.getRooms?.() ?? [])
  .filter((room: any) => room.getMyMembership?.() === 'join')
  .map((room: any) => room.roomId)
  .filter((roomId: unknown): roomId is string => typeof roomId === 'string' && roomId.length > 0)

const searchResults = await client.searchRoomEvents({
  term: normalizedTerm,
  filter: { rooms: joinedRoomIds, limit },
})
```

### Stable append-on-pagination by eventId

```ts
// Source: src/features/chat/stores/retrievalStore.ts
function mergeResults(current: RetrievalItem[], next: RetrievalItem[]) {
  const merged = [...current]
  const seenEventIds = new Set(current.map(item => item.eventId))

  for (const item of next) {
    if (seenEventIds.has(item.eventId))
      continue
    seenEventIds.add(item.eventId)
    merged.push(item)
  }

  return merged
}
```

### Canonical preload-then-focus navigation contract

```ts
// Source pattern: src/features/chat/components/TaskPanel.vue
try {
  await loadInboxEventContext(roomId, eventId)
}
catch (error) {
  console.warn('[task-panel] failed to preload source context, fallback to direct navigation', error)
}

await router.push({
  path: `/dm/${encodeURIComponent(roomId)}`,
  query: { focusEventId: eventId },
})
```

## State of the Art

| Old Approach                                                  | Current Approach                                                                    | When Changed               | Impact                                                                            |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------- |
| Room-scoped `SearchMessages.vue` using direct SDK room filter | Cross-conversation `matrix/retrieval.ts` + `retrievalStore.ts` + `GlobalSearch.vue` | Phase 3                    | Search logic now supports `RETR-01/02`, but real mount integration still missing. |
| Non-virtualized search hit list                               | `@tanstack/vue-virtual` bounded rendering with jsdom fallback                       | Phase 5                    | Production search can stay responsive under heavy result sets.                    |
| Unlimited wait on preload before navigation                   | 250ms bounded preload race                                                          | Phase 5                    | Reachable jumps must remain responsive for `RELI-02`.                             |
| Legacy `/chat/:roomId` navigation habit                       | Canonical `/dm/:roomId` route                                                       | Router currently redirects | Phase 6 should remove legacy-path dependence from search jumps.                   |

**Deprecated/outdated:**

- `SearchMessages.vue` as the production search surface: outdated for milestone scope because it is room-limited and its result jump is unwired.
- `/chat/:roomId` for requirement-critical result jumps: outdated as a canonical target because router treats it as a redirect only.

## Open Questions

1. **Should reopening search restore the previous query or reset to blank?**
   - What we know: current old panel behaves like a fresh session; current retrieval implementation has persistent store state but local query input.
   - What's unclear: desired UX memory for reopen was never specified.
   - Recommendation: plan for explicit reset-on-close/open unless product explicitly wants recall; it is the safer integration choice.

2. **Should the integrated panel keep room quick-results together with message hits in the side-panel width?**
   - What we know: current `GlobalSearch.vue` mixes room quick-results and message hits in one 480px modal.
   - What's unclear: whether the 320px side-panel shell needs layout adaptation or a compact variant.
   - Recommendation: keep the unified surface, but plan a compact side-panel layout instead of a teleported modal.

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Vitest `^4.0.18` + Vue Test Utils `^2.4.6` + Playwright `^1.58.2`                                                                                                                                    |
| Config file        | `vitest.config.ts`, `playwright.config.ts`                                                                                                                                                           |
| Quick run command  | `pnpm vitest run tests/unit/matrix/retrieval.test.ts tests/components/GlobalSearch.test.ts tests/components/GlobalSearch.performance.test.ts tests/components/ChatWindow.search.integration.test.ts` |
| Full suite command | `pnpm test:unit && pnpm test:e2e`                                                                                                                                                                    |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                                                                              | Test Type                    | Automated Command                                                                                                                                  | File Exists? |
| ------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| RETR-01 | Header search trigger reaches the real cross-conversation retrieval panel, supports submit + pagination + result jump | component/integration        | `pnpm vitest run tests/components/ChatWindow.search.integration.test.ts tests/components/GlobalSearch.test.ts`                                     | ❌ Wave 0    |
| RETR-02 | Reachable search flow only shows joined-room results even when stale/left-room data exists                            | unit + component/integration | `pnpm vitest run tests/unit/matrix/retrieval.test.ts tests/components/GlobalSearch.test.ts tests/components/ChatWindow.search.integration.test.ts` | ⚠️ partial   |
| RELI-02 | Real mounted search path keeps bounded rendering and 250ms preload budget                                             | component/performance        | `pnpm vitest run tests/components/GlobalSearch.performance.test.ts tests/components/ChatWindow.search.integration.test.ts`                         | ⚠️ partial   |

### Sampling Rate

- **Per task commit:** `pnpm vitest run tests/unit/matrix/retrieval.test.ts tests/components/GlobalSearch.test.ts tests/components/GlobalSearch.performance.test.ts tests/components/ChatWindow.search.integration.test.ts`
- **Per wave merge:** `pnpm test:unit`
- **Phase gate:** `pnpm test:unit && pnpm test:e2e` green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/components/ChatWindow.search.integration.test.ts` — proves `ChatHeader -> ChatWindow -> real retrieval panel` wiring, close behavior, and reachable jump chain
- [ ] `tests/components/ChatWindow.search.integration.test.ts` — exercises canonical `/dm` navigation with `focusEventId` instead of mocked `/chat` pushes
- [ ] Optional routed smoke: `tests/e2e/search-surface.spec.ts` — valuable if planner wants one browser-level proof that real router redirect/query behavior cannot regress silently

## Sources

### Primary (HIGH confidence)

- Codebase: `src/features/chat/components/ChatWindow.vue` — real search mount currently points to `SearchMessages.vue`
- Codebase: `src/features/chat/components/SearchMessages.vue` — reachable legacy room-scoped implementation and unwired `jumpTo` emit
- Codebase: `src/features/chat/components/GlobalSearch.vue` — current cross-conversation retrieval UI, virtualization, bounded preload, and legacy `/chat` navigation
- Codebase: `src/features/chat/stores/retrievalStore.ts` — single search session state, deduped pagination, unused `resetState()`
- Codebase: `src/matrix/retrieval.ts` — joined-room request scoping and pagination session contract
- Codebase: `src/matrix/inbox.ts` — canonical preload context chain
- Codebase: `src/app/router/index.ts` — canonical `/dm` route and legacy `/chat` redirect
- Official docs: https://router.vuejs.org/guide/essentials/redirect-and-alias.html — redirect functions should explicitly forward query when needed
- Official docs: https://tanstack.com/virtual/v3/docs/framework/vue/vue-virtual — Vue virtualizer API used by the repo
- Official docs: https://tanstack.com/virtual/latest/docs/api/virtualizer — `estimateSize` and `overscan` guidance
- Official docs/API: https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html — `searchRoomEvents` and `backPaginateRoomEventsSearch` APIs exist on current SDK
- Official release: https://github.com/matrix-org/matrix-js-sdk/releases/tag/v41.0.0 — confirms current repo dependency version is current as of 2026-02-24

### Secondary (MEDIUM confidence)

- `.planning/v1.0-MILESTONE-AUDIT.md` — milestone-level integration findings and broken-flow evidence
- `.planning/phases/03-cross-conversation-retrieval/03-02-SUMMARY.md` — confirms intended retrieval architecture and decisions
- `.planning/phases/05-reliability-and-performance-consistency/05-02-SUMMARY.md` — confirms virtualization + bounded preload patterns to preserve

### Tertiary (LOW confidence)

- None

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** - directly verified from `package.json`, current code, and official library docs/releases
- Architecture: **HIGH** - confirmed by codebase mount points, audit findings, and existing phase summaries
- Pitfalls: **HIGH** - most are direct code/audit mismatches; `/chat` redirect query-loss risk is **MEDIUM-HIGH** until exercised with a real router test

**Research date:** 2026-03-06
**Valid until:** 2026-04-05
