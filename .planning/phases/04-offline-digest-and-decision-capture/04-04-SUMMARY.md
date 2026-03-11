---
phase: 04-offline-digest-and-decision-capture
plan: 04
subsystem: ui
tags: [qa, retrieval, citations, side-panel, vitest]

# Dependency graph
requires:
  - phase: 04-offline-digest-and-decision-capture
    provides: digest and decision panels plus shared knowledge shell from 04-01/02/03
provides:
  - Cross-session QA service grounded in retrieval results and citations
  - CrossSessionQaPanel UI with citation jump verification flow
  - Unified Knowledge side-panel integration across digest, decision, and QA tabs
affects: [phase-04-verification, knowledge-sidebar, citation-grounded-qa]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Cross-session answers are composed only from retrieval hits and persisted with citation arrays
    - Knowledge features reuse the existing chat side-panel state machine instead of creating new routes

key-files:
  created:
    - src/features/chat/services/crossSessionQa.ts
    - src/features/chat/components/CrossSessionQaPanel.vue
    - tests/unit/services/crossSessionQa.test.ts
    - tests/components/CrossSessionQaPanel.test.ts
  modified:
    - src/features/chat/components/KnowledgeCapturePanel.vue
    - src/features/chat/stores/chatStore.ts
    - src/features/chat/components/ChatWindow.vue
    - src/features/server/components/ChannelSidebar.vue
    - src/locales/en.json
    - src/locales/zh.json

key-decisions:
  - "Build DECI-03 on top of existing retrieval results instead of introducing a separate AI-only evidence path."
  - "Mount Knowledge as a side-panel state (`knowledge`) alongside existing search/tasks panels."
  - "Keep QA citation navigation on the same preload-then-focusEventId chain used elsewhere in the product."

patterns-established:
  - "Pattern: knowledge entry points belong in the DM sidebar and render through `chatStore.activeSidePanel`."
  - "Pattern: QA answers persist citation-backed answer records through the shared knowledge repository."

requirements-completed: [DECI-03]

# Metrics
duration: 3 min
completed: 2026-03-06
---

# Phase 4 Plan 4: Cross-Session QA Integration Summary

**Cross-session Q&A now delivers citation-grounded answers inside a unified Knowledge side panel that also hosts digest and decision workflows.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-06T13:18:33+08:00
- **Completed:** 2026-03-06T13:21:41+08:00
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Added a retrieval-backed QA service that composes answers only from cited message hits and persists them.
- Added CrossSessionQaPanel with ask / render / citation-jump behavior.
- Integrated digest, decision, and QA into one Knowledge side panel reachable from the DM sidebar.

## Task Commits

Each task was committed atomically:

1. **Task 1: 先写 cross-session QA RED 测试（Wave 0）** - `410f0cb` (test)
2. **Task 2: 实现 QA 服务与 Knowledge 统一入口集成（GREEN）** - `0af1c76` (feat)

## Files Created/Modified

- `src/features/chat/services/crossSessionQa.ts` - Retrieval-backed cited answer generation and persistence.
- `src/features/chat/components/CrossSessionQaPanel.vue` - Q&A UI, answer display, and citation navigation.
- `src/features/chat/components/KnowledgeCapturePanel.vue` - Real digest / decision / QA panel integration.
- `src/features/chat/stores/chatStore.ts` - Added `knowledge` side-panel state.
- `src/features/chat/components/ChatWindow.vue` - Mounted KnowledgeCapturePanel into the chat side-panel region.
- `src/features/server/components/ChannelSidebar.vue` - Added Knowledge entry button in DM mode.
- `src/locales/en.json`, `src/locales/zh.json` - Added Knowledge and Q&A locale strings.
- `tests/unit/services/crossSessionQa.test.ts` - Service coverage for cited answers and retrieval scoping.
- `tests/components/CrossSessionQaPanel.test.ts` - Component coverage for answer rendering, citation jump, and knowledge integration toggle.

## Decisions Made

- Reused retrieval service output directly as QA evidence, which keeps DECI-03 under the same joined-room authorization guarantees as Phase 3.
- Used the existing side-panel mechanism for Knowledge to avoid adding a second navigation paradigm.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Knowledge panel integration test initially checked QA content without switching tabs**

- **Found during:** Task 2 (实现 QA 服务与 Knowledge 统一入口集成)
- **Issue:** `KnowledgeCapturePanel` defaults to the digest tab, so the QA child component is not visible until the QA tab is selected.
- **Fix:** Updated the integration test to switch to the QA tab before asserting `CrossSessionQaPanel` presence.
- **Files modified:** `tests/components/CrossSessionQaPanel.test.ts`
- **Verification:** `pnpm vitest run tests/unit/services/crossSessionQa.test.ts tests/components/CrossSessionQaPanel.test.ts`
- **Committed in:** `0af1c76`

**2. [Rule 3 - Blocking] Plan verification command used unsupported Vitest `-x` flag**

- **Found during:** Task 1 (先写 cross-session QA RED 测试)
- **Issue:** The planned flag is unsupported in this repo’s Vitest CLI.
- **Fix:** Used the equivalent file-targeted command without `-x`, then ran `pnpm test:unit` for wider regression coverage.
- **Files modified:** None
- **Verification:** `pnpm vitest run tests/unit/services/crossSessionQa.test.ts tests/components/CrossSessionQaPanel.test.ts && pnpm test:unit`
- **Committed in:** `0af1c76`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** No scope change; fixes only aligned tests/tooling with the implemented panel behavior and local Vitest CLI.

## Issues Encountered

- `pnpm test:unit` passed, but existing unrelated locale warning noise remains in several older component tests due incomplete `zh.json` coverage outside Phase 4 scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 4 user-facing capabilities now exist behind a single Knowledge entry point.
- Ready for phase-level verification against DIGE / DECI requirements and must-have truths.

---

_Phase: 04-offline-digest-and-decision-capture_
_Completed: 2026-03-06_

## Self-Check: PASSED

- FOUND: `.planning/phases/04-offline-digest-and-decision-capture/04-04-SUMMARY.md`
- FOUND: `410f0cb`
- FOUND: `0af1c76`
