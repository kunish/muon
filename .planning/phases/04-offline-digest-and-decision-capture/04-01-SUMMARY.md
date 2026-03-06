---
phase: 04-offline-digest-and-decision-capture
plan: 01
subsystem: database
tags: [dexie, zod, vue, knowledge, vitest]

# Dependency graph
requires:
  - phase: 03-cross-conversation-retrieval
    provides: retrieval DTO conventions and preload-then-navigate citation jump pattern
provides:
  - Shared citation-first contracts for digest, decision cards, and cross-session QA answers
  - Dexie-backed knowledge database schema with repository helpers for digest/decision/qa entities
  - Unified KnowledgeCapturePanel shell with digest/decision/qa tab slots
affects: [04-02-offline-digest, 04-03-decision-capture, 04-04-cross-session-qa]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Shared knowledge entities carry both `citations` and materialized `citationEventIds` for traceability plus indexed lookup
    - Knowledge repository logic is injected with table-like adapters so Dexie-backed code stays testable without browser IndexedDB in Vitest

key-files:
  created:
    - src/features/chat/types/knowledge.ts
    - src/shared/lib/knowledgeDb.ts
    - src/features/chat/components/KnowledgeCapturePanel.vue
    - tests/unit/stores/knowledgeDb.test.ts
  modified: []

key-decisions:
  - "Use one shared `knowledge.ts` contract file for digest/decision/qa instead of splitting types before domain behavior exists."
  - "Persist `citationEventIds` alongside rich citation objects so Dexie can index event links directly."
  - "Keep KnowledgeCapturePanel as the single future side-panel entry, avoiding new routes or parallel navigation surfaces."

patterns-established:
  - "Pattern: citation-first entities must validate non-empty citations through zod schemas before persistence."
  - "Pattern: repository helpers accept injected table adapters for fast Vitest coverage while production uses Dexie tables."

requirements-completed: [DIGE-01, DIGE-02, DIGE-03, DECI-01, DECI-02, DECI-03]

# Metrics
duration: 3 min
completed: 2026-03-06
---

# Phase 4 Plan 1: Offline Knowledge Foundation Summary

**Shared citation-first contracts, Dexie knowledge storage, and a unified Knowledge side-panel shell now exist for all Phase 4 features.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-06T12:59:10+08:00
- **Completed:** 2026-03-06T13:01:45+08:00
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added shared Zod-backed types for citations, digest entries, decision cards, suggestions, and cross-session QA answers.
- Added `MuonKnowledgeDB` with versioned Dexie store definitions and repository helpers for digest / decision / QA persistence flows.
- Added `KnowledgeCapturePanel` as a single tabbed shell for future digest, decision, and QA subpanels.

## Task Commits

Each task was committed atomically:

1. **Task 1: 建立共享知识合同与 Knowledge DB 的 RED 测试** - `93b1bce` (test)
2. **Task 2: 实现 Dexie 持久化仓储与 Knowledge 面板壳层（GREEN）** - `baa0f77` (feat)

## Files Created/Modified
- `src/features/chat/types/knowledge.ts` - Shared domain contracts and validation schemas for all knowledge features.
- `src/shared/lib/knowledgeDb.ts` - Dexie schema plus repository helpers for saving and querying knowledge entities.
- `src/features/chat/components/KnowledgeCapturePanel.vue` - Unified tab shell for digest, decision, and QA surfaces.
- `tests/unit/stores/knowledgeDb.test.ts` - Contract coverage for schema constraints, indexes, repository queries, and suggestion disposition updates.

## Decisions Made
- Centralized all citation-bearing entities in one contract file to keep Wave 2 and Wave 3 aligned on a single data shape.
- Stored `citationEventIds` separately from citation objects so event-based indexes remain simple and deterministic.
- Used injected table adapters in repository tests to avoid adding extra IndexedDB test dependencies during Phase 4 foundation work.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan verification command used unsupported Vitest `-x` flag**
- **Found during:** Task 1 (建立共享知识合同与 Knowledge DB 的 RED 测试)
- **Issue:** `pnpm vitest run ... -x` fails in this repo’s Vitest 4 CLI with `Unknown option '-x'`.
- **Fix:** Executed the equivalent verification command without `-x` and continued with the same targeted test file.
- **Files modified:** None
- **Verification:** `pnpm vitest run tests/unit/stores/knowledgeDb.test.ts` produced the intended RED then GREEN cycle.
- **Committed in:** `baa0f77`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope change; only adjusted the verification invocation to match the installed Vitest CLI.

## Issues Encountered
- Vitest CLI in this project does not support the planned `-x` flag; used the file-targeted run command instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 2 plans can now build digest and decision behavior against a stable shared knowledge contract and persistence layer.
- Knowledge side-panel shell is ready for integration with real digest / decision / QA content in later plans.

---
*Phase: 04-offline-digest-and-decision-capture*
*Completed: 2026-03-06*

## Self-Check: PASSED

- FOUND: `.planning/phases/04-offline-digest-and-decision-capture/04-01-SUMMARY.md`
- FOUND: `93b1bce`
- FOUND: `baa0f77`
