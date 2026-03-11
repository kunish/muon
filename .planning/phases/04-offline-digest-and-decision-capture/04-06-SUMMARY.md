---
phase: 04-offline-digest-and-decision-capture
plan: 06
subsystem: ui
tags: [digest, matrix, pinia, vitest, vue]

# Dependency graph
requires:
  - phase: 04-offline-digest-and-decision-capture
    provides: digest contracts, materializer, and Knowledge panel shell from 04-02/04-05
provides:
  - Saved digest hydration on Knowledge panel reopen
  - Runtime Matrix message ingestion for away-window digest refresh
  - Real responsibility/follow/mention relevance materialization
affects: [knowledge-panel, offline-digest, citation-navigation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Digest store initializes by hydrating persisted entries before rebuilding the current away-window session
    - Digest relevance derives from room pinned/highlight signals plus current-user mention heuristics instead of manual test hints

key-files:
  created: []
  modified:
    - src/features/chat/types/digest.ts
    - src/matrix/digest.ts
    - src/features/chat/stores/digestStore.ts
    - src/features/chat/components/OfflineDigestPanel.vue
    - tests/unit/stores/digestStore.test.ts
    - tests/components/OfflineDigestPanel.test.ts

key-decisions:
  - "Hydrate persisted digest entries before any away-window rebuild so reopened Knowledge panels never start empty."
  - "Subscribe digest runtime sync directly to matrixEvents room.message and expose explicit start/stop actions to avoid duplicate listeners."
  - "Derive follow from pinned rooms and responsibility from highlight/current-user mention heuristics, with mention as the final fallback bucket."

patterns-established:
  - "Pattern: Knowledge tab mount triggers store-level initializeDigest while component unmount tears down runtime listeners."
  - "Pattern: materializeOfflineDigest owns room/user relevance derivation so UI and store sorting stay deterministic."

requirements-completed: [DIGE-01, DIGE-02, DIGE-03]

# Metrics
duration: 2 min
completed: 2026-03-06
---

# Phase 4 Plan 6: Offline Digest Runtime Recovery Summary

**Knowledge digest now rehydrates saved entries, subscribes to live Matrix room messages, and derives responsibility/follow/mention ordering from real room and user signals.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-06T09:37:54Z
- **Completed:** 2026-03-06T09:40:29Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added RED coverage for digest hydration order, runtime `room.message` wiring, and real relevance derivation.
- Implemented `initializeDigest`, runtime sync lifecycle, and persisted-entry hydration in the digest store.
- Moved digest relevance materialization to real Matrix room/user signals and wired panel mount/unmount to initialization and teardown.

## Task Commits

Each task was committed atomically:

1. **Task 1: 先锁定 digest 回读、运行时订阅与真实 relevance 的失败测试** - `7a94345` (test)
2. **Task 2: 实现 digest 初始化、真实消息接线与 relevance materialization** - `5ccb34a` (feat)

## Files Created/Modified

- `src/features/chat/types/digest.ts` - Adds room-signal relevance derivation helpers and explicit digest room signal typing.
- `src/matrix/digest.ts` - Materializes digest entries from real room summaries and current user identity.
- `src/features/chat/stores/digestStore.ts` - Hydrates saved entries, manages runtime Matrix listeners, and rebuilds away-window sessions.
- `src/features/chat/components/OfflineDigestPanel.vue` - Initializes digest data on mount and stops runtime sync on unmount while preserving citation navigation.
- `tests/unit/stores/digestStore.test.ts` - Covers hydration order, runtime event ingestion, and real relevance mapping.
- `tests/components/OfflineDigestPanel.test.ts` - Verifies mount-time initialization plus existing citation preload/fallback behavior.

## Decisions Made

- Hydration happens before away-window refresh so users immediately regain persisted digest context when reopening Knowledge.
- Runtime sync is explicit store lifecycle state instead of implicit component-only wiring, which prevents duplicate `room.message` listeners.
- Real relevance remains deterministic by centralizing pinned/highlight/current-user mention mapping inside digest materialization.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DIGE-01/02/03 runtime gaps are closed for the digest tab, so Knowledge reopen behavior now matches the Phase 4 must-haves.
- Remaining Phase 4 work can build on the same hydrate-on-open and citation-first runtime pattern for decision and suggestion flows.

---

_Phase: 04-offline-digest-and-decision-capture_
_Completed: 2026-03-06_

## Self-Check: PASSED

- FOUND: `.planning/phases/04-offline-digest-and-decision-capture/04-06-SUMMARY.md`
- FOUND: `7a94345`
- FOUND: `5ccb34a`
