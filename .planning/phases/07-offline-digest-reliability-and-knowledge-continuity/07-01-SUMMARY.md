# 07-01 Summary: Wave 0 — RED Tests

## Objective

Lock in 6 failing tests that expose 3 specific bugs identified in `07-RESEARCH.md` before writing any fix.

## Test Inventory

### digestStore.test.ts (+2 tests, 5 total)

| #   | Test Name                                                                                       | Target Gap      | RED Reason                                                                                   |
| --- | ----------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------- |
| 1   | initializeDigest preserves hydrated entries when sourceEvents is empty and lastOfflineAt is set | DIGE-01/DIGE-03 | `buildDigestSession()` unconditionally overwrites `entries.value` with empty materialization |
| 2   | buildDigestSession does not overwrite hydrated entries with empty materialization               | DIGE-03         | Same root cause — no merge-on-empty guard                                                    |

### decisionStore.test.ts (+2 tests, 7 total)

| #   | Test Name                                                                        | Target Gap | RED Reason                                                             |
| --- | -------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------- |
| 3   | hydrateCards only materializes digest-backed suggestions from the latest session | DECI-02    | `hydrateCards()` calls `listDigestEntries()` without session filtering |
| 4   | stale digest entries from older sessions do not generate new suggestion cards    | DECI-02    | Same — all historical entries generate suggestions                     |

### OfflineDigestPanel.test.ts (+1 test, 4 total)

| #   | Test Name                                                         | Target Gap | RED Reason                                                                   |
| --- | ----------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------- |
| 5   | remounting panel after unmount shows previously persisted entries | DIGE-01    | Panel remount re-runs `initializeDigest()` which overwrites hydrated entries |

### DecisionPanel.test.ts (+1 test, 5 total)

| #   | Test Name                                                                     | Target Gap | RED Reason                                              |
| --- | ----------------------------------------------------------------------------- | ---------- | ------------------------------------------------------- |
| 6   | digest-backed suggestions are visible only from latest-session digest entries | DECI-02    | Component-level verification of stale session filtering |

## RED Verification

All 6 new tests failed as expected. All 15 pre-existing tests remained GREEN.

```
Tests:  6 failed | 15 passed (across 4 test files)
```

## Key Patterns Used

- **Dynamic `await import()`** for stores to ensure `vi.mock()` replacements take effect
- **`listDigestEntriesMock`** returns persisted entries before mount (hydration happens in `onMounted`)
- **Multi-session test data**: newer session (no actionable keywords) + older session (with action/blocker keywords) to test session-scoped filtering

## Files Modified

- `tests/unit/stores/digestStore.test.ts`
- `tests/unit/stores/decisionStore.test.ts`
- `tests/components/OfflineDigestPanel.test.ts`
- `tests/components/DecisionPanel.test.ts`
