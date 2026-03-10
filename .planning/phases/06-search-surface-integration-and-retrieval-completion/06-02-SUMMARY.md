---
phase: 06-search-surface-integration-and-retrieval-completion
plan: 02
type: summary
status: complete
---

# Plan 06-02 Summary: Search Surface Integration Implementation

## What was done

### Task 1: Refactor GlobalSearch.vue into inline side-panel

**`src/features/chat/components/GlobalSearch.vue`** — full rewrite from Teleport modal to inline side-panel:

1. **Removed `<Teleport to="body">`** — component now renders directly as a flex column (`flex flex-col h-full`) that fills the 320px side-panel shell in `ChatWindow`
2. **Removed modal overlay** — no more `fixed inset-0 z-50 bg-black/50` backdrop; removed 480px fixed width
3. **Navigation `/chat/` → `/dm/`** — both `selectRoom()` and `jumpToResult()` now navigate to canonical `/dm/${encodeURIComponent(roomId)}`, eliminating the redirect hop through the legacy `/chat/:roomId?` route
4. **`resetState()` lifecycle** — `onMounted` calls `retrievalStore.resetState()` to clear stale results on open; `onUnmounted` calls it again on close
5. **Preserved** — `@tanstack/vue-virtual` virtualizer, joined-room filtering, 250ms preload budget via `Promise.race`, ESC keydown handler, `close` emit

**`src/features/chat/stores/retrievalStore.ts`** — no code changes needed; `resetState()` already existed but was never called. Now wired into GlobalSearch lifecycle.

**`tests/components/GlobalSearch.test.ts`** — updated mock to include `resetState`, removed `Teleport: true` stub
**`tests/components/GlobalSearch.performance.test.ts`** — removed `Teleport: true` stub

### Task 2: Rewire ChatWindow and retire SearchMessages

**`src/features/chat/components/ChatWindow.vue`**:
- Replaced `import SearchMessages from './SearchMessages.vue'` with `import GlobalSearch from './GlobalSearch.vue'`
- Changed template from `<SearchMessages v-if="store.activeSidePanel === 'search' && store.currentRoomId" :room-id="..." @close="..." />` to `<GlobalSearch v-if="store.activeSidePanel === 'search'" @close="store.closeSidePanel()" />`
- Removed `currentRoomId` guard — GlobalSearch handles cross-conversation search and doesn't need a room context

**`src/features/chat/components/SearchMessages.vue`** — deleted. No remaining imports.

**`tests/components/KnowledgeCapturePanel.integration.test.ts`** — updated mock from `SearchMessages.vue` to `GlobalSearch.vue`

## Test results

| Test file | Result |
|-----------|--------|
| ChatWindow.search.integration.test.ts | 5/5 ✓ |
| GlobalSearch.test.ts | 4/4 ✓ |
| GlobalSearch.performance.test.ts | 2/2 ✓ |
| KnowledgeCapturePanel.integration.test.ts | 3/3 ✓ |
| Full suite (33 files) | 32 passed, 1 pre-existing failure (lottie-web) |

## Files modified
- `src/features/chat/components/GlobalSearch.vue` (refactored: Teleport modal → inline panel, /dm/ nav, resetState lifecycle)
- `src/features/chat/components/ChatWindow.vue` (SearchMessages → GlobalSearch)
- `src/features/chat/components/SearchMessages.vue` (deleted)
- `tests/components/GlobalSearch.test.ts` (added resetState mock, removed Teleport stub)
- `tests/components/GlobalSearch.performance.test.ts` (removed Teleport stub)
- `tests/components/KnowledgeCapturePanel.integration.test.ts` (SearchMessages → GlobalSearch mock)

## Success criteria met
- ✅ ChatWindow's reachable search path uses cross-conversation retrieval panel, not SearchMessages
- ✅ Search result and room jumps use canonical `/dm` navigation with `focusEventId` and 250ms preload budget
- ✅ Retrieval reopen behavior is deterministic — `resetState()` called on mount/unmount, no stale results
