---
phase: 04-offline-digest-and-decision-capture
plan: 07
subsystem: ui
tags: [decision, digest, citations, pinia, vitest]

# Dependency graph
requires:
  - phase: 04-offline-digest-and-decision-capture
    provides: decision persistence, digest persistence, and Knowledge panel wiring from 04-01/03/05
provides:
  - Decision tab hydration for saved cards and digest-backed drafts
  - Deterministic digest-summary suggestion extraction with audit-preserving rematerialization
  - Linked-message rendering and jump-back navigation in DecisionPanel
affects: [04-08-gap-closure, decision-ui, knowledge-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Digest-backed decision drafts use stable ids derived from digest entry ids
    - Suggestion rematerialization preserves persisted disposition audit fields instead of resetting to pending

key-files:
  created:
    - src/features/chat/services/suggestionExtraction.ts
    - tests/unit/services/suggestionExtraction.test.ts
  modified:
    - src/features/chat/stores/decisionStore.ts
    - src/features/chat/components/DecisionPanel.vue
    - tests/unit/stores/decisionStore.test.ts
    - tests/components/DecisionPanel.test.ts

key-decisions:
  - "Digest summaries are converted into stable decision drafts with ids in the form decision:digest:<entry-id>."
  - "Digest suggestion ids are deterministic (<entry-id>:<kind>:<index>) so re-hydration can merge with existing audit history."
  - "DecisionPanel reuses loadInboxEventContext plus focusEventId routing for linked-message verification instead of adding a new navigation path."

patterns-established:
  - "Pattern: hydrateCards loads persisted cards first, then rematerializes digest-backed drafts on top of the same store state."
  - "Pattern: suggestion rematerialization overlays persisted disposition metadata onto newly extracted content."

requirements-completed: [DECI-01, DECI-02]

# Metrics
duration: 2 min
completed: 2026-03-06
---

# Phase 4 Plan 7: Decision Hydration and Traceability Summary

**Decision tab now restores saved cards, materializes digest-backed pending suggestions, and lets users jump back to linked source messages for verification.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-06T17:38:06+08:00
- **Completed:** 2026-03-06T09:39:58Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added deterministic digest-summary suggestion extraction for `action` and `blocker` items with preserved citations.
- Extended `decisionStore` with `hydrateCards()` and digest-backed draft materialization while preserving accepted/rejected audit state.
- Updated `DecisionPanel` to load hydrated cards on mount, render linked messages, and jump back to source events with preload + fallback navigation.

## Task Commits

Each task was committed atomically:

1. **Task 1: 先锁定 decision 回读、linked-message 回跳与 suggestion extraction 的失败测试** - `52377b4` (test)
2. **Task 2: 实现 digest suggestion 提取、decision 回读与 linked-message 追溯 UI** - `4ba80fd` (feat)

## Files Created/Modified
- `src/features/chat/services/suggestionExtraction.ts` - Extracts deterministic action/blocker suggestions from digest title/summary text.
- `src/features/chat/stores/decisionStore.ts` - Hydrates persisted cards, materializes digest-backed drafts, and preserves suggestion disposition audits.
- `src/features/chat/components/DecisionPanel.vue` - Loads hydrated cards, renders linked messages, and reuses Matrix focus navigation.
- `tests/unit/services/suggestionExtraction.test.ts` - Locks extraction ids, citation preservation, and no-signal fallback.
- `tests/unit/stores/decisionStore.test.ts` - Covers saved-card hydration, digest draft materialization, and disposition preservation across rematerialization.
- `tests/components/DecisionPanel.test.ts` - Covers hydrated rendering plus linked-message jump behavior.

## Decisions Made
- Used digest entry ids as the source of truth for draft decision ids so repeated materialization merges into the same persisted card.
- Preserved accepted/rejected audit metadata when digest suggestions are regenerated, preventing rematerialization from erasing user intent.
- Reused the established Matrix preload-then-focus navigation chain for linked-message verification.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Decision hydration and traceability gaps called out in Phase 4 verification are now closed for DECI-01/02.
- Ready for the remaining Phase 4 gap-closure work and final phase verification.

---
*Phase: 04-offline-digest-and-decision-capture*
*Completed: 2026-03-06*

## Self-Check: PASSED

- FOUND: `.planning/phases/04-offline-digest-and-decision-capture/04-07-SUMMARY.md`
- FOUND: `52377b4`
- FOUND: `4ba80fd`
