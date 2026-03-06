---
phase: 05-reliability-and-performance-consistency
plan: 01
subsystem: api
tags: [matrix, sync, inbox, recovery, vitest]

# Dependency graph
requires:
  - phase: 04-offline-digest-and-decision-capture
    provides: preload-then-fallback inbox navigation and shared knowledge-era inbox behaviors
provides:
  - Explicit Matrix reconnect/catch-up sync lifecycle emission
  - Canonical room summaries derived from live timelines during recovery
  - Recovery-triggered unified inbox recomputation with regression coverage
affects: [matrix sync, unified inbox, recovery verification]

# Tech tracking
tech-stack:
  added: []
  patterns: [Emit sync lifecycle through matrixEvents, prefer live timeline room summaries with best-effort fallback, refresh inbox immediately on recovery sync events]

key-files:
  created: [tests/mocks/recovery.ts, tests/unit/matrix/syncRecovery.test.ts, tests/components/UnifiedInboxPanel.recovery.test.ts]
  modified: [src/matrix/types.ts, src/matrix/events.ts, src/matrix/sync.ts, src/matrix/rooms.ts, src/features/chat/composables/useUnifiedInbox.ts]

key-decisions:
  - "Promote RECONNECTING and CATCHUP to first-class SyncState values and emit every sync lifecycle change through matrixEvents."
  - "Derive room summaries from getLiveTimeline().getEvents() first, falling back to legacy timeline data only when live visible events are unavailable."
  - "Treat recovery sync.state events as immediate unified inbox refresh triggers instead of waiting for a new room.message event."

patterns-established:
  - "Recovery reconciliation: Matrix sync lifecycle changes fan out through matrixEvents before inbox recomputation."
  - "Timeline resilience: latest visible inbox context prefers live timeline data while keeping best-effort fallback ordering metadata."

requirements-completed: [RELI-01]

# Metrics
duration: 11 min
completed: 2026-03-06
---

# Phase 5 Plan 1: Reconnect-Safe Matrix Inbox Recovery Summary

**Matrix reconnect lifecycle emission plus live-timeline inbox recovery so restored rooms reappear without waiting for brand-new messages.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-06T10:39:41Z
- **Completed:** 2026-03-06T10:50:41Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Added RED regression coverage for reconnect state emission, canonical recovery recompute, and limited-timeline summary drift.
- Extended Matrix sync handling to emit `sync.state` for reconnect/catch-up/prepared/syncing/error/stop transitions.
- Reworked room summary and unified inbox refresh logic to reconcile from live timeline room state during recovery.

## Task Commits

Each task was committed atomically:

1. **Task 1: Lock reconnect and catch-up inbox recovery behavior with failing tests** - `54c66b6` (test)
2. **Task 2: Implement canonical sync and inbox reconciliation for reconnect recovery** - `7f37da1` (feat)

**Plan metadata:** pending

## Files Created/Modified
- `tests/mocks/recovery.ts` - Shared recovery fixtures for sync lifecycle and limited-timeline rooms.
- `tests/unit/matrix/syncRecovery.test.ts` - Regression tests for sync lifecycle emission and live timeline summary derivation.
- `tests/components/UnifiedInboxPanel.recovery.test.ts` - Component recovery tests for inbox refresh without fresh message delivery.
- `src/matrix/types.ts` - SyncState contract now includes reconnect and catch-up lifecycle states.
- `src/matrix/events.ts` - `sync.state` event payload is typed to the canonical SyncState union.
- `src/matrix/sync.ts` - Sync bridge emits lifecycle events while preserving retry-on-error behavior.
- `src/matrix/rooms.ts` - Room summaries derive latest visible message metadata from live timelines with fallback.
- `src/features/chat/composables/useUnifiedInbox.ts` - Recovery sync events trigger immediate canonical inbox refresh and test cleanup removes leaked listeners.

## Decisions Made
- Emitted sync lifecycle updates from the sync bridge rather than adding a separate recovery store, matching the plan’s single-source-of-truth constraint.
- Kept live-timeline fallback best-effort in `rooms.ts` so limited timelines preserve visible ordering without assuming perfect history continuity.
- Left preload-then-fallback navigation untouched; this plan only changed sync/inbox reconciliation surfaces.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reset recovery listeners between component tests**
- **Found during:** Task 2 (canonical sync and inbox reconciliation)
- **Issue:** New `sync.state` listeners in `useUnifiedInbox()` leaked across tests, making recovery assertions order-dependent.
- **Fix:** Added explicit `matrixEvents.off(...)` cleanup in `__resetUnifiedInboxForTests()` and stabilized async recovery assertions with condition-based waiting.
- **Files modified:** `src/features/chat/composables/useUnifiedInbox.ts`, `tests/components/UnifiedInboxPanel.recovery.test.ts`
- **Verification:** `pnpm vitest run tests/unit/matrix/syncRecovery.test.ts tests/components/UnifiedInboxPanel.recovery.test.ts tests/unit/matrix/inbox.test.ts`
- **Committed in:** `7f37da1`

**2. [Rule 3 - Blocking] Replaced obsolete Vitest `-x` flag during execution verification**
- **Found during:** Task 1 verification
- **Issue:** The plan’s canned `pnpm vitest ... -x` command is not supported by Vitest 4 in this repo, so RED verification aborted before executing tests.
- **Fix:** Ran the equivalent targeted `pnpm vitest run ...` command without `-x` for RED/GREEN verification.
- **Files modified:** None (execution flow only)
- **Verification:** Targeted recovery test runs produced expected RED failures, then GREEN passes.
- **Committed in:** N/A

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes were required to make the planned recovery coverage reliable and executable. No scope creep.

## Issues Encountered
- Component recovery assertions were initially timing-sensitive; switching to condition-based waiting removed the flake while keeping the intended behavior checks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- RELI-01 Matrix inbox recovery is covered and implemented, ready for Phase 05 Plan 02 performance work.
- No blocker found for the next plan.

## Self-Check: PASSED

- Found summary target path `.planning/phases/05-reliability-and-performance-consistency/05-01-SUMMARY.md`.
- Verified task commits `54c66b6` and `7f37da1` exist in git history.
