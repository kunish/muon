---
phase: 04-offline-digest-and-decision-capture
plan: 08
subsystem: ui
tags: [qa, history, pinia, citations, vitest]

# Dependency graph
requires:
  - phase: 04-offline-digest-and-decision-capture
    provides: cross-session QA service and knowledge side-panel wiring from 04-04/05
provides:
  - QA history hydration for saved cross-session answers
  - Knowledge QA panel replay of latest saved cited answer on reopen
  - Dedicated qaStore orchestration for hydrate + ask flows
affects: [phase-04-verification, knowledge-sidebar, qa-history]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Side-panel knowledge features hydrate saved history through a Pinia store before rendering
    - QA follow-up questions update active answer while preserving saved answer history ordering

key-files:
  created:
    - src/features/chat/stores/qaStore.ts
    - tests/unit/stores/qaStore.test.ts
  modified:
    - src/features/chat/services/crossSessionQa.ts
    - src/features/chat/components/CrossSessionQaPanel.vue
    - tests/unit/services/crossSessionQa.test.ts
    - tests/components/CrossSessionQaPanel.test.ts

key-decisions:
  - "Introduce a dedicated qaStore to own history hydration and active-answer selection instead of letting the panel talk to persistence directly."
  - "Keep QA citation jumps on the existing preload + focusEventId navigation chain while adding history replay."

patterns-established:
  - "Pattern: history-backed knowledge tabs should restore persisted records on mount via store hydrate actions."
  - "Pattern: saved QA sessions are rendered newest-first and reused as the default active answer when reopening the panel."

requirements-completed: [DECI-03]

# Metrics
duration: 3 min
completed: 2026-03-06
---

# Phase 4 Plan 8: QA History Restoration Summary

**QA history hydration via qaStore now lets the Knowledge panel reopen with the latest cited answer while preserving earlier cross-session questions.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-06T17:39:10+08:00
- **Completed:** 2026-03-06T17:41:54+08:00
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added a dedicated qaStore that hydrates persisted QA history and tracks the currently displayed answer.
- Extended the QA service with saved-session listing so store hydration can replay prior answers newest-first.
- Updated CrossSessionQaPanel to restore the latest saved answer on mount and keep earlier history visible after follow-up questions.

## Task Commits

Each task was committed atomically:

1. **Task 1: 先锁定 QA 历史恢复与面板回显的失败测试** - `c5d1e7a` (test)
2. **Task 2: 实现 qaStore、历史读取 API 与 QA 面板回显** - `3ced806` (feat)

## Files Created/Modified

- `src/features/chat/stores/qaStore.ts` - Hydrates saved QA sessions, tracks history, and manages the active answer.
- `src/features/chat/services/crossSessionQa.ts` - Exposes saved QA session listing alongside ask flow.
- `src/features/chat/components/CrossSessionQaPanel.vue` - Replays saved answers on mount and renders a selectable QA history list.
- `tests/unit/stores/qaStore.test.ts` - Covers history hydration and follow-up question retention.
- `tests/unit/services/crossSessionQa.test.ts` - Covers saved-session listing order.
- `tests/components/CrossSessionQaPanel.test.ts` - Covers mount-time replay, follow-up history retention, and citation navigation.

## Decisions Made

- Introduced qaStore as the single orchestration point for history replay and active-answer updates so the component stays focused on rendering.
- Kept saved QA history newest-first and defaulted the panel to the latest answer to match reopen expectations.
- Preserved the existing preload-first citation navigation chain instead of introducing a separate history-specific jump path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Mocked knowledge repository in component tests to avoid IndexedDB runtime failures**

- **Found during:** Task 2 (实现 qaStore、历史读取 API 与 QA 面板回显)
- **Issue:** `KnowledgeCapturePanel` imports other knowledge stores during component tests, which triggered IndexedDB access in jsdom and produced an unhandled runtime error.
- **Fix:** Added a focused `knowledgeDb` mock in `tests/components/CrossSessionQaPanel.test.ts` so the panel test stays scoped to QA history behavior.
- **Files modified:** `tests/components/CrossSessionQaPanel.test.ts`
- **Verification:** `pnpm vitest run tests/unit/stores/qaStore.test.ts tests/unit/services/crossSessionQa.test.ts tests/components/CrossSessionQaPanel.test.ts`
- **Committed in:** `3ced806`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope creep; the auto-fix only stabilized the intended QA-focused test environment.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- QA reopen behavior now satisfies the verification gap around "save but not replay" for DECI-03.
- Phase 4 still needs separate follow-up work for digest and decision history/readback gaps tracked in verification.

---

_Phase: 04-offline-digest-and-decision-capture_
_Completed: 2026-03-06_

## Self-Check: PASSED

- FOUND: `.planning/phases/04-offline-digest-and-decision-capture/04-08-SUMMARY.md`
- FOUND: `c5d1e7a`
- FOUND: `3ced806`
