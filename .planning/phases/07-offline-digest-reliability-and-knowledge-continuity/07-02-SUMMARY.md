# 07-02 Summary: Wave 1 — GREEN Implementation

## Objective
Fix the 3 bugs identified in `07-RESEARCH.md` and turn all 6 RED tests GREEN.

## Bugs Fixed

### Bug 1: digestStore merge-on-empty (DIGE-01/DIGE-03)
**File**: `src/features/chat/stores/digestStore.ts`, `buildDigestSession()` lines 119-122
**Root Cause**: `entries.value = nextSession.entries` unconditionally overwrote hydrated entries when `sourceEvents` was empty (after panel close/reopen).
**Fix**: Added merge-on-empty guard:
```typescript
if (nextSession.entries.length === 0 && entries.value.length > 0) {
  return // preserve existing hydrated entries
}
entries.value = nextSession.entries
```

### Bug 2: sourceEvents reset on panel remount (DIGE-03)
**Root Cause**: `sourceEvents` is a plain `ref([])` that resets on each store creation. Runtime-ingested events lost on panel close.
**Fix**: The merge-on-empty fix in Bug 1 handles this — hydrated entries from Dexie are preserved as the authoritative source when sourceEvents is empty.

### Bug 3: decisionStore stale session suggestions (DECI-02)
**File**: `src/features/chat/stores/decisionStore.ts`, `hydrateCards()` lines 80-87
**Root Cause**: `repository.listDigestEntries()` returned ALL historical digest entries without session filtering, causing stale entries from old sessions to generate phantom suggestions.
**Fix**: Added session-scoped filtering:
```typescript
const allDigestEntries = await repository.listDigestEntries()
const latestSessionId = allDigestEntries.length > 0
  ? allDigestEntries[0].sessionId
  : null
const currentSessionEntries = latestSessionId
  ? allDigestEntries.filter(e => e.sessionId === latestSessionId)
  : []
```

## Test Refinements During Implementation
1. **OfflineDigestPanel remount test**: `listDigestEntriesMock` must return persisted entries BEFORE mount (not after), because `onMounted` → `initializeDigest()` → `hydrateDigestEntries()` calls `listDigestEntries()` immediately.
2. **DecisionStore stale session test**: Added a current session entry (no action/blocker keywords) alongside old session entries (with action/blocker) to properly test session-scoping filter.

## GREEN Verification

```
Test Files  1 failed | 32 passed (33)
Tests       2 failed | 120 passed (122)
```

All 21 Phase 7-related tests pass:
- digestStore: 5/5 ✅
- decisionStore: 7/7 ✅
- OfflineDigestPanel: 4/4 ✅
- DecisionPanel: 5/5 ✅

The 2 failures are pre-existing `MessageBubble.test.ts` lottie-web issues, unrelated to our work.

## Files Modified
- `src/features/chat/stores/digestStore.ts` (merge-on-empty guard)
- `src/features/chat/stores/decisionStore.ts` (session-scoped filtering)
- `tests/unit/stores/digestStore.test.ts` (test refinements)
- `tests/unit/stores/decisionStore.test.ts` (test refinements)
- `tests/components/OfflineDigestPanel.test.ts` (test refinements)
- `tests/components/DecisionPanel.test.ts` (test refinements)
