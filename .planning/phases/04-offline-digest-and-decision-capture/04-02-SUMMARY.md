---
phase: 04-offline-digest-and-decision-capture
plan: 02
subsystem: ui
tags: [digest, dexie, pinia, matrix, vitest]

# Dependency graph
requires:
  - phase: 04-offline-digest-and-decision-capture
    provides: shared knowledge contracts, Dexie repository helpers, and Knowledge panel shell from 04-01
provides:
  - Offline digest materialization for away-window events
  - Digest Pinia store with relevance sorting and snapshot persistence
  - OfflineDigestPanel UI with citation jump fallback behavior
affects: [04-04-knowledge-integration, digest-ui, citation-navigation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Digest entries derive from matrix source events and remain citation-first end to end
    - Digest sorting is centralized in store/type helpers instead of being reimplemented in the component

key-files:
  created:
    - src/features/chat/types/digest.ts
    - src/matrix/digest.ts
    - src/features/chat/stores/digestStore.ts
    - src/features/chat/components/OfflineDigestPanel.vue
    - tests/unit/stores/digestStore.test.ts
    - tests/components/OfflineDigestPanel.test.ts
  modified: []

key-decisions:
  - "Use a simple source-event → digest-entry materializer first, while preserving citation-first structure for future summarization upgrades."
  - "Let digestStore own relevance filtering/sorting so every digest surface renders the same order."
  - "Reuse loadInboxEventContext + focusEventId for digest citation jumps, keeping failure non-blocking."

patterns-established:
  - "Pattern: digest panels render from store-visible entries instead of directly reading raw source events."
  - "Pattern: offline window filtering happens in materializeOfflineDigest using explicit windowStart/windowEnd bounds."

requirements-completed: [DIGE-01, DIGE-02, DIGE-03]

# Metrics
duration: 2 min
completed: 2026-03-06
---

# Phase 4 Plan 2: Offline Digest Summary

**Away-window digest sessions now materialize into relevance-sorted entries with citation-based jump-back verification.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-06T13:07:51+08:00
- **Completed:** 2026-03-06T13:09:32+08:00
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added digest source-event/session types and a Matrix-side materializer that filters events inside the away window.
- Added digestStore with centralized relevance ordering and persistence through the shared knowledge repository.
- Added OfflineDigestPanel with citation jump navigation and graceful preload fallback.

## Task Commits

Each task was committed atomically:

1. **Task 1: 先写 digest store + panel 的 RED 测试（Wave 0）** - `64e5f60` (test)
2. **Task 2: 实现 digest materialization/store/panel 并转绿** - `ad185b0` (feat)

## Files Created/Modified

- `src/features/chat/types/digest.ts` - Digest source-event/session types and shared ordering helpers.
- `src/matrix/digest.ts` - Away-window digest materialization from ingested Matrix events.
- `src/features/chat/stores/digestStore.ts` - Digest state, filtering, sorting, and persistence bridge.
- `src/features/chat/components/OfflineDigestPanel.vue` - Digest list UI and citation jump actions.
- `tests/unit/stores/digestStore.test.ts` - Store coverage for away-window filtering and relevance sorting.
- `tests/components/OfflineDigestPanel.test.ts` - UI coverage for rendering and citation jump success/fallback flows.

## Decisions Made

- Kept the first version of digest materialization event-granular, but ensured every entry carries citations and can later be replaced by higher-level summarization without schema churn.
- Stored ordering logic in shared helpers so responsibility/follow/mention ordering stays deterministic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan verification command used unsupported Vitest `-x` flag**

- **Found during:** Task 1 (先写 digest store + panel 的 RED 测试)
- **Issue:** The planned `-x` flag is not supported by this repo’s Vitest CLI.
- **Fix:** Used the file-targeted `pnpm vitest run tests/unit/stores/digestStore.test.ts tests/components/OfflineDigestPanel.test.ts` command instead.
- **Files modified:** None
- **Verification:** The adjusted command produced the expected RED then GREEN cycle.
- **Committed in:** `ad185b0`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope change; only normalized the verification command to match installed tooling.

## Issues Encountered

- None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Digest behavior is ready to be mounted into the unified Knowledge panel in 04-04.
- Citation jump semantics now match inbox/task/search flows, reducing integration risk for final Phase 4 assembly.

---

_Phase: 04-offline-digest-and-decision-capture_
_Completed: 2026-03-06_

## Self-Check: PASSED

- FOUND: `.planning/phases/04-offline-digest-and-decision-capture/04-02-SUMMARY.md`
- FOUND: `64e5f60`
- FOUND: `ad185b0`
