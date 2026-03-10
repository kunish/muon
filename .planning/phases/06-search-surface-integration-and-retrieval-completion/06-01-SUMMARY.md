---
phase: 06-search-surface-integration-and-retrieval-completion
plan: 01
type: summary
status: complete
---

# Plan 06-01 Summary: Test-First Search Integration Contract

## What was done

### Task 1: ChatWindow.search.integration.test.ts (NEW)
Created `tests/components/ChatWindow.search.integration.test.ts` with 5 integration tests that prove the real `ChatHeader → ChatWindow → GlobalSearch` mount path:

1. **Opens real retrieval panel** — asserts `[data-testid="global-search-form"]` exists and `SearchMessages` component does NOT exist
2. **Cross-conversation results with joined-room filtering** — submits search, expects joined-room hits visible, left-room hits filtered (RETR-02)
3. **Load-more pagination** — first page rendered, load-more button triggers `backPaginateRoomEventsSearch`, second page appears
4. **Canonical `/dm` navigation with `focusEventId`** — clicking a result must navigate to `/dm/!joined%3Amuon.dev` (not legacy `/chat/`), with preload before navigation
5. **Clean close/reopen without stale results** — closing and reopening the panel must not show previous results (verifies `resetState()` integration)

**Mock challenge solved**: `@matrix/index` re-exports `getRoom` from `./rooms`, which calls `getClient()` internally. Using `importOriginal` alone caused `getRoom is not a function` errors. Fixed by using `importOriginal` for side-effect-free exports (e.g., `matrixEvents`) while explicitly overriding `getRoom`, `getRoomTopic`, and `sendTyping` in the mock.

### Task 2: GlobalSearch test navigation updates
Updated navigation assertions in existing test files:

- **`GlobalSearch.test.ts`**: Changed 2 assertions from `/chat/!joined%3Amuon.dev` → `/dm/!joined%3Amuon.dev` (tests: "jump to result" and "fallback navigation")
- **`GlobalSearch.performance.test.ts`**: Changed 1 assertion from `/chat/!joined%3Amuon.dev` → `/dm/!joined%3Amuon.dev` (test: "preload timeout budget")

## RED verification

All 8 failing tests fail for the correct architectural reasons:

| Test file | Failures | Reason |
|-----------|----------|--------|
| ChatWindow.search.integration.test.ts | 5/5 | ChatWindow mounts `SearchMessages`, not `GlobalSearch` |
| GlobalSearch.test.ts | 2/4 | Code navigates `/chat/`, tests expect `/dm/` |
| GlobalSearch.performance.test.ts | 1/2 | Code navigates `/chat/`, tests expect `/dm/` |

## Files modified
- `tests/components/ChatWindow.search.integration.test.ts` (created, 281 lines)
- `tests/components/GlobalSearch.test.ts` (2 path assertions changed)
- `tests/components/GlobalSearch.performance.test.ts` (1 path assertion changed)
