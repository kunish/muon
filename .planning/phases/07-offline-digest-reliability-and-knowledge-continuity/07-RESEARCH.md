# Phase 7: Offline Digest Reliability and Knowledge Continuity - Research

**Researched:** 2026-03-09
**Domain:** Digest session persistence, away-window materialization reliability, digest-backed decision pipeline continuity
**Confidence:** HIGH

## User Constraints

- No `CONTEXT.md` exists for this phase.
- Locked scope comes from roadmap/audit/codebase evidence:
  - Must close production digest-reliability gaps from the milestone audit.
  - Must satisfy `DIGE-01`, `DIGE-02`, `DIGE-03`, and `DECI-02` in the _real_ Knowledge panel lifecycle.
  - Must preserve the existing citation-first entity model and bounded preload jump contract.
  - Must not break existing digest/decision/QA test suites (114/116 currently green; 2 pre-existing lottie failures).
- Out of scope:
  - Semantic/vector retrieval (`RETR-03`)
  - Search surface integration (Phase 6 — complete)
  - New knowledge entity types or QA pipeline changes
  - Digest summarization quality improvements (AI-powered summarization is deferred)

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                         | Research Support                                                                                                                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DIGE-01 | User returns after being offline and can view a concise digest sorted by responsibility/follow/mention.             | Reuse `digestStore.initializeDigest()` + `materializeOfflineDigest()`; fix the overwrite-on-empty-session gap so reopen restores saved entries reliably.                                                                                |
| DIGE-02 | User can open source message citations from digest entries for verification.                                        | Reuse `loadInboxEventContext()` + `focusEventId` jump; ensure stable digest entries are visible before attempting citation navigation.                                                                                                  |
| DIGE-03 | Locally-synced messages from the offline period are stably materialized into digest entries within the away window. | Fix `buildDigestSession()` overwrite behavior when `sourceEvents` is empty but `lastOfflineAt` is set; ensure runtime-ingested events accumulate correctly across panel reopen cycles.                                                  |
| DECI-02 | Digest-backed suggestions appear reliably in the decision pipeline.                                                 | Fix `decisionStore.hydrateCards()` dependency on `digestStore.entries` population order; ensure digest-backed cards materialize when digest entries exist in Dexie but have not yet been loaded into the digest store's reactive state. |

</phase_requirements>

## Summary

Phase 7 is a reliability gap-closure phase, not a greenfield feature phase. The core digest/decision infrastructure was built in Phase 4 (plans 04-01 through 04-08) and includes:

- `digestStore` with `initializeDigest()`, `hydrateDigestEntries()`, `buildDigestSession()`, and runtime `room.message` subscription
- `decisionStore` with `hydrateCards()` and `materializeSuggestionsFromDigest()`
- `OfflineDigestPanel.vue` with citation jump navigation
- `DecisionPanel.vue` with linked-message navigation and suggestion accept/reject
- Dexie-backed `knowledgeDb` with repository helpers for persistence

The audit identified three reliability gaps that prevent these features from working correctly under real lifecycle conditions:

### Gap 1: Empty-session overwrite on Knowledge panel reopen (DIGE-01, DIGE-03)

**Root cause:** `digestStore.buildDigestSession()` unconditionally replaces `entries.value` with the materialized session result. When `sourceEvents` is empty (which happens after panel unmount+remount because `sourceEvents` is a plain `ref` that starts empty), the call at line `digestStore.ts:120` sets `entries.value = nextSession.entries` where `nextSession.entries` is `[]`. This wipes out any previously hydrated entries.

The `initializeDigest()` method calls `hydrateDigestEntries()` first (which correctly loads from Dexie), but then immediately calls `buildDigestSession()` which overwrites with an empty materialization because `sourceEvents` is empty at that point.

**Fix direction:** `buildDigestSession()` should merge with (not replace) hydrated entries. When `sourceEvents` produces zero entries within the window, the method should preserve existing hydrated entries instead of clearing them. Additionally, `sourceEvents` should be populated from Dexie-persisted entries on hydration so rematerialization can work with historical data.

### Gap 2: Runtime event ingestion not surviving panel close/reopen (DIGE-03)

**Root cause:** `stopRuntimeSync()` is called on `OfflineDigestPanel` unmount, which correctly stops the `room.message` listener. However, `sourceEvents` is never persisted and starts as an empty `ref([])` on each store creation. When the panel reopens and `initializeDigest()` runs, `sourceEvents` is empty, so the new `buildDigestSession()` call has no raw events to work with.

**Fix direction:** Since digest entries are already persisted to Dexie by `buildDigestSession()`, the real fix is to ensure `initializeDigest()` uses hydrated entries as the authoritative source when `sourceEvents` is empty. The current hydrate-then-rebuild flow should short-circuit the rebuild when `sourceEvents` is empty and hydrated entries already cover the away window.

### Gap 3: Decision hydration reads digest entries before they are loaded (DECI-02)

**Root cause:** `decisionStore.hydrateCards()` at line `decisionStore.ts:80` calls `repository.listDigestEntries()` directly from Dexie and iterates them through `materializeSuggestionsFromDigest()`. This works in isolation. However, the `DecisionPanel.vue` `onMounted` calls `decisionStore.hydrateCards()` which reads digest entries from Dexie. If the user navigates to the Decision tab before the Digest tab has been mounted (which triggers `initializeDigest()` and persists entries to Dexie), the Dexie table may be stale or empty from a previous session. The decision store reads from Dexie independently and does not depend on `digestStore.entries` reactive state. This is actually the correct design — the gap is that if NO digest entries have ever been persisted (fresh install or cleared DB), `materializeSuggestionsFromDigest` correctly returns `null` and no suggestions appear. The real issue is: when digest entries ARE in Dexie from a previous session but the away-window has changed, the decision store materializes stale digest data into suggestions. There is no mechanism to scope digest-backed suggestions to the current away window.

**Fix direction:** Add an `awayWindowId` or `sessionId` scope filter to the decision store's digest-backed materialization so it only processes digest entries from the current or most recent session, not all historical entries.

## Standard Stack

### Core

| Library | Version   | Purpose                                  | Why Standard                                                                    |
| ------- | --------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| Vue     | `^3.5.29` | SFC UI composition                       | Existing app standard; all knowledge surfaces use Vue SFCs.                     |
| Pinia   | `^3.0.4`  | Digest and decision state                | `digestStore.ts` and `decisionStore.ts` own lifecycle and persistence bridging. |
| Dexie   | `^4.0.10` | Offline knowledge persistence            | `knowledgeDb.ts` already owns the Dexie schema and repository helpers.          |
| Zod     | `^3.24.2` | Schema validation for knowledge entities | `knowledge.ts` contracts enforce citation-first validation.                     |

### Supporting

| Library         | Version   | Purpose                           | When to Use                                                        |
| --------------- | --------- | --------------------------------- | ------------------------------------------------------------------ |
| @vue/test-utils | `^2.4.6`  | Component mounting                | Use for OfflineDigestPanel/DecisionPanel lifecycle tests.          |
| Vitest          | `^4.0.18` | Unit/component/integration tests  | Use for all Phase 7 automated guards.                              |
| mitt            | `^3.0.1`  | Event bus for Matrix room.message | Already used by `matrixEvents`; digest runtime sync depends on it. |

### Alternatives Considered

| Instead of                               | Could Use                                                                 | Tradeoff                                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Merge-on-empty in `buildDigestSession`   | Always rebuild from Dexie-persisted events                                | Heavier: would require storing raw `DigestSourceEvent` objects in Dexie (schema change). Merge-on-empty is simpler and preserves existing schema. |
| Session-scoped digest-backed suggestions | Always rematerialize all digest entries into decisions                    | Current behavior; causes stale cross-session suggestions that confuse the decision pipeline.                                                      |
| Persisting `sourceEvents` to Dexie       | Relying on hydrated entries as source of truth when sourceEvents is empty | Recommended: avoids schema changes; hydrated entries already carry the materialized data.                                                         |

**Installation:**

```bash
pnpm install
```

## Architecture Patterns

### Recommended Project Structure

```text
src/
├── features/chat/stores/
│   ├── digestStore.ts           # fix: merge-on-empty + session-aware hydration
│   └── decisionStore.ts         # fix: session-scoped digest-backed materialization
├── features/chat/components/
│   ├── OfflineDigestPanel.vue   # existing; no changes expected
│   ├── DecisionPanel.vue        # existing; no changes expected
│   └── KnowledgeCapturePanel.vue # existing; no changes expected
├── features/chat/types/
│   ├── digest.ts                # existing digest types
│   └── knowledge.ts             # existing knowledge contracts
├── matrix/
│   └── digest.ts                # existing materializer
└── shared/lib/
    └── knowledgeDb.ts           # existing Dexie repository

tests/
├── unit/stores/
│   ├── digestStore.test.ts      # extend: reopen/merge/empty-session tests
│   └── decisionStore.test.ts    # extend: session-scoped suggestion tests
├── components/
│   ├── OfflineDigestPanel.test.ts  # extend: reopen-preserves-entries test
│   └── DecisionPanel.test.ts       # extend: digest-backed suggestion visibility test
```

### Pattern 1: Merge-on-empty session rebuild

**What:** When `buildDigestSession()` produces zero entries because `sourceEvents` is empty, preserve existing hydrated entries instead of replacing them with an empty array.
**When to use:** Every `initializeDigest()` call after panel reopen.
**Example:**

```ts
// Proposed fix in digestStore.ts
async function buildDigestSession(options = {}) {
  // ... existing window logic ...
  const nextSession = materializeOfflineDigest(sourceEvents.value, { ... })
  session.value = nextSession

  if (nextSession.entries.length === 0 && entries.value.length > 0) {
    // Preserve hydrated entries; do not overwrite with empty materialization
    return entries.value
  }

  entries.value = nextSession.entries
  await Promise.all(nextSession.entries.map(entry => repository.saveDigestEntry(entry)))
  return nextSession.entries
}
```

### Pattern 2: Session-scoped digest suggestion materialization

**What:** The decision store's `hydrateCards()` should filter digest entries by the most recent session before materializing suggestions, preventing stale cross-session entries from generating outdated suggestions.
**When to use:** Every `decisionStore.hydrateCards()` call.
**Example:**

```ts
// Proposed fix in decisionStore.ts
async function hydrateCards() {
  const savedCards = await repository.listDecisionCards()
  cards.value = savedCards.map(card => decisionCardSchema.parse(card))
    .sort((left, right) => right.updatedAt - left.updatedAt)

  const digestEntries = await repository.listDigestEntries()
  // Only materialize suggestions from the most recent session
  const latestSessionId = digestEntries[0]?.sessionId
  const currentSessionEntries = latestSessionId
    ? digestEntries.filter(entry => entry.sessionId === latestSessionId)
    : []

  await Promise.all(currentSessionEntries.map(entry =>
    materializeSuggestionsFromDigest(entry)
  ))

  return cards.value
}
```

### Pattern 3: Guard against null windowStart in initializeDigest

**What:** When `lastOfflineAt` is null (user has never been offline), `initializeDigest()` should skip `buildDigestSession()` and return hydrated entries directly. The current code already does this — but the guard returns `entries.value` before calling `buildDigestSession()`, which is correct. The issue is when `lastOfflineAt` IS set but `sourceEvents` is empty.
**When to use:** Already applied; preserve this guard.

### Anti-Patterns to Avoid

- **Unconditionally replacing `entries.value` in `buildDigestSession()`:** Causes the empty-session overwrite gap.
- **Reading all historical digest entries for suggestion materialization:** Generates stale suggestions from old sessions.
- **Persisting `sourceEvents` as a new Dexie table:** Unnecessary schema change; hydrated entries already serve as the materialized source of truth.
- **Coupling `digestStore.entries` reactive state to `decisionStore.hydrateCards()`:** Creates timing dependencies between tab mount order; both stores should read from Dexie independently.

## Don't Hand-Roll

| Problem                   | Don't Build                       | Use Instead                                          | Why                                                             |
| ------------------------- | --------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| Digest entry persistence  | Custom localStorage serialization | Dexie `knowledgeDb.ts` repository                    | Already established; schema, indexes, and zod validation exist. |
| Citation jump navigation  | New navigation path               | `loadInboxEventContext()` + `/dm/` + `focusEventId`  | Canonical chain used across inbox/task/search/digest panels.    |
| Digest relevance ordering | Manual sort in each component     | `compareDigestEntries()` + `visibleEntries` computed | Centralized in `digest.ts` types and `digestStore`.             |
| Suggestion extraction     | AI pipeline in the store          | `extractSuggestionsFromSummary()` service            | Already extracts action/blocker patterns deterministically.     |

## Common Pitfalls

### Pitfall 1: Empty session overwrites hydrated digest entries

**What goes wrong:** User reopens Knowledge panel and sees "No digest entries yet" despite having previous digest data.
**Why it happens:** `initializeDigest()` calls `hydrateDigestEntries()` (populates from Dexie), then `buildDigestSession()` (materializes from empty `sourceEvents`), which replaces `entries.value` with `[]`.
**How to avoid:** Make `buildDigestSession()` merge-aware: when materialization produces zero entries and hydrated entries exist, preserve hydrated entries.
**Warning signs:** `digestStore.entries` is populated after `hydrateDigestEntries()` but empty after `initializeDigest()` completes.

### Pitfall 2: Stale digest-backed suggestions from previous sessions

**What goes wrong:** Decision tab shows suggestion cards from a digest session that is days old and irrelevant.
**Why it happens:** `decisionStore.hydrateCards()` reads ALL digest entries from Dexie without session filtering.
**How to avoid:** Filter digest entries by the latest `sessionId` before materializing suggestions.
**Warning signs:** Decision cards appear for digest entries that no longer show in the digest tab.

### Pitfall 3: Runtime event listener leak on rapid tab switching

**What goes wrong:** Multiple `room.message` handlers accumulate if user rapidly switches between Knowledge tabs.
**Why it happens:** `startRuntimeSync()` has a guard (`if (runtimeHandler) return`) but if the store is recreated (HMR or test isolation), the module-level `runtimeHandler` variable resets while the old listener remains on `matrixEvents`.
**How to avoid:** The existing guard is sufficient for production (Pinia stores are singletons). For tests, ensure `stopRuntimeSync()` is called in cleanup. This is already handled.
**Warning signs:** Duplicate digest entries from the same event appearing in the list.

### Pitfall 4: Digest citation jump fails silently when entry is from a stale session

**What goes wrong:** User clicks "Open citation" on a hydrated digest entry, but the room timeline no longer has the event in cache.
**Why it happens:** The event is from a previous session and Matrix SDK local cache has been evicted.
**How to avoid:** The existing preload-then-fallback pattern in `OfflineDigestPanel.vue` already handles this gracefully (console.warn + navigate anyway). No additional work needed.
**Warning signs:** Navigation succeeds but the focused event is not highlighted in the timeline — this is acceptable degraded behavior.

## Code Examples

Verified project patterns:

### Digest hydration from Dexie

```ts
// Source: src/features/chat/stores/digestStore.ts:51-56
async function hydrateDigestEntries() {
  const savedEntries = await repository.listDigestEntries()
  entries.value = [...savedEntries].sort(compareDigestEntries)
  session.value = null
  return entries.value
}
```

### Away-window materialization

```ts
// Source: src/matrix/digest.ts:13-36
export function materializeOfflineDigest(events, options) {
  const roomSignals = new Map(getRoomSummaries().map(s => [s.roomId, s]))
  const currentUserId = getClient().getUserId?.() ?? null
  const entries = events
    .filter(event => event.ts >= options.windowStart && event.ts <= options.windowEnd)
    .map((event) => {
      const relevance = deriveDigestRelevance(event, { roomSignal: roomSignals.get(event.roomId), currentUserId })
      return toDigestEntry(options.sessionId, event, relevance)
    })
    .sort(compareDigestEntries)
  return { id: options.sessionId, entries, windowStart: options.windowStart, windowEnd: options.windowEnd, createdAt: options.windowEnd }
}
```

### Decision store digest-backed materialization

```ts
// Source: src/features/chat/stores/decisionStore.ts:76-84
async function hydrateCards() {
  const savedCards = await repository.listDecisionCards()
  cards.value = savedCards.map(card => decisionCardSchema.parse(card))
    .sort((left, right) => right.updatedAt - left.updatedAt)
  const digestEntries = await repository.listDigestEntries()
  await Promise.all(digestEntries.map(entry => materializeSuggestionsFromDigest(entry)))
  return cards.value
}
```

## State of the Art

| Old Approach               | Current Approach                                                     | When Changed     | Impact                                                                                               |
| -------------------------- | -------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------- |
| No digest persistence      | Dexie-backed `saveDigestEntry()` in `buildDigestSession()`           | Phase 4, Plan 06 | Digest entries survive app restart but get overwritten on panel reopen due to empty-session rebuild. |
| Decision cards standalone  | `hydrateCards()` reads digest entries for suggestion materialization | Phase 4, Plan 07 | Digest-backed suggestions work but are not session-scoped, causing stale cross-session leakage.      |
| No runtime event ingestion | `room.message` subscription in `startRuntimeSync()`                  | Phase 4, Plan 06 | Live events enter digest but are lost on panel close because `sourceEvents` is not persisted.        |

**Deprecated/outdated:**

- Unconditional `entries.value = nextSession.entries` in `buildDigestSession()`: must be replaced with merge-on-empty semantics.
- Unfiltered `repository.listDigestEntries()` in `decisionStore.hydrateCards()`: must be scoped to current/latest session.

## Open Questions

1. **Should digest entries from older sessions be visible in the digest tab alongside current session entries?**
   - What we know: current code replaces entries entirely with the latest session. Phase 4 Plan 06 explicitly says "hydrate saved entries before rebuilding."
   - What's unclear: whether users expect to see a rolling history or only the latest away-window.
   - Recommendation: Show the latest session entries as primary, but preserve hydrated entries when the latest session is empty (merge-on-empty). Do not show a rolling multi-session history — that would require UI changes beyond Phase 7 scope.

2. **Should `sourceEvents` be preserved across panel close/reopen cycles?**
   - What we know: `sourceEvents` is a plain ref that resets on store creation. Runtime events are ingested during panel open but lost on close.
   - What's unclear: whether preserving raw events is important or if persisted digest entries are sufficient.
   - Recommendation: Do NOT persist `sourceEvents`. The persisted digest entries in Dexie are the authoritative record. When `sourceEvents` is empty, use hydrated entries as the display source. New runtime events will be materialized into the session when they arrive.

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Vitest `^4.0.18` + Vue Test Utils `^2.4.6`                                                                                                                                         |
| Config file        | `vitest.config.ts`                                                                                                                                                                 |
| Quick run command  | `pnpm vitest run tests/unit/stores/digestStore.test.ts tests/unit/stores/decisionStore.test.ts tests/components/OfflineDigestPanel.test.ts tests/components/DecisionPanel.test.ts` |
| Full suite command | `pnpm vitest run`                                                                                                                                                                  |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                                                           | Test Type        | Automated Command                                                                                   | File Exists?                                         |
| ------- | -------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| DIGE-01 | Reopening Knowledge panel preserves hydrated digest entries when session rebuild has no new events | unit + component | `pnpm vitest run tests/unit/stores/digestStore.test.ts tests/components/OfflineDigestPanel.test.ts` | ❌ Wave 0                                            |
| DIGE-02 | Citation jump works from hydrated (not just freshly-materialized) digest entries                   | component        | `pnpm vitest run tests/components/OfflineDigestPanel.test.ts`                                       | ⚠️ partial (existing test covers fresh entries only) |
| DIGE-03 | Away-window materialization does not produce empty sessions when Dexie has persisted entries       | unit             | `pnpm vitest run tests/unit/stores/digestStore.test.ts`                                             | ❌ Wave 0                                            |
| DECI-02 | Digest-backed suggestions are scoped to the latest session and do not leak stale entries           | unit             | `pnpm vitest run tests/unit/stores/decisionStore.test.ts`                                           | ❌ Wave 0                                            |

### Sampling Rate

- **Per task commit:** `pnpm vitest run tests/unit/stores/digestStore.test.ts tests/unit/stores/decisionStore.test.ts tests/components/OfflineDigestPanel.test.ts tests/components/DecisionPanel.test.ts`
- **Per wave merge:** `pnpm vitest run`
- **Phase gate:** `pnpm vitest run` green before marking phase complete

### Wave 0 Gaps

- [x] `tests/unit/stores/digestStore.test.ts` — add test: initializeDigest preserves hydrated entries when sourceEvents is empty
- [x] `tests/unit/stores/digestStore.test.ts` — add test: buildDigestSession merges (not overwrites) when materialization is empty but hydrated entries exist
- [x] `tests/unit/stores/decisionStore.test.ts` — add test: hydrateCards only materializes suggestions from latest session digest entries
- [x] `tests/components/OfflineDigestPanel.test.ts` — add test: remounting panel shows previously hydrated entries (not empty state)

## Sources

### Primary (HIGH confidence)

- Codebase: `src/features/chat/stores/digestStore.ts` — unconditional `entries.value = nextSession.entries` at line 120 is the empty-session overwrite root cause
- Codebase: `src/features/chat/stores/decisionStore.ts` — unfiltered `repository.listDigestEntries()` at line 80 reads all historical digest entries
- Codebase: `src/matrix/digest.ts` — `materializeOfflineDigest()` correctly filters by window but receives empty events when sourceEvents is empty
- Codebase: `src/features/chat/components/OfflineDigestPanel.vue` — `onMounted` calls `initializeDigest()` and `onUnmounted` calls `stopRuntimeSync()`
- Codebase: `src/shared/lib/knowledgeDb.ts` — Dexie repository with `listDigestEntries()` returning all entries ordered by createdAt desc
- Phase 4 summaries: 04-01 through 04-08 — document the intended lifecycle and identify gaps that were partially closed

### Secondary (MEDIUM confidence)

- `.planning/ROADMAP.md` — Phase 7 success criteria define the three must-have truths
- `.planning/phases/04-offline-digest-and-decision-capture/04-06-SUMMARY.md` — documents the hydration-before-rebuild pattern that is currently incomplete

### Tertiary (LOW confidence)

- None

## Metadata

**Confidence breakdown:**

- Gap 1 (empty-session overwrite): **HIGH** - directly traceable in source code line 120 of digestStore.ts
- Gap 2 (sourceEvents not surviving reopen): **HIGH** - ref initialization is empty; no persistence path exists
- Gap 3 (stale digest suggestions): **HIGH** - `listDigestEntries()` has no session filter in decisionStore line 80
- Fix directions: **HIGH** - merge-on-empty and session filtering are low-risk, well-scoped changes

**Research date:** 2026-03-09
**Valid until:** 2026-04-09
