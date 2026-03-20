---
phase: 07
slug: offline-digest-reliability-and-knowledge-continuity
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-09
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Vitest 4.0.18 + Vue Test Utils 2.4.6                                                                                                                                               |
| **Config file**        | `vitest.config.ts`                                                                                                                                                                 |
| **Quick run command**  | `pnpm vitest run tests/unit/stores/digestStore.test.ts tests/unit/stores/decisionStore.test.ts tests/components/OfflineDigestPanel.test.ts tests/components/DecisionPanel.test.ts` |
| **Full suite command** | `pnpm vitest run`                                                                                                                                                                  |
| **Estimated runtime**  | ~30 seconds                                                                                                                                                                        |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run tests/unit/stores/digestStore.test.ts tests/unit/stores/decisionStore.test.ts tests/components/OfflineDigestPanel.test.ts tests/components/DecisionPanel.test.ts`
- **After every plan wave:** Run `pnpm vitest run`
- **Before marking phase complete:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement       | Test Type | Automated Command                                                                                    | File Exists | Status     |
| -------- | ---- | ---- | ----------------- | --------- | ---------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 07-01-01 | 01   | 0    | DIGE-01 / DIGE-03 | unit      | `pnpm vitest run tests/unit/stores/digestStore.test.ts`                                              | ⚠️ extend   | ⬜ pending |
| 07-01-02 | 01   | 0    | DECI-02           | unit      | `pnpm vitest run tests/unit/stores/decisionStore.test.ts`                                            | ⚠️ extend   | ⬜ pending |
| 07-01-03 | 01   | 0    | DIGE-01 / DIGE-02 | component | `pnpm vitest run tests/components/OfflineDigestPanel.test.ts tests/components/DecisionPanel.test.ts` | ⚠️ extend   | ⬜ pending |
| 07-02-01 | 02   | 1    | DIGE-01 / DIGE-03 | unit      | `pnpm vitest run tests/unit/stores/digestStore.test.ts`                                              | ⬜ W0       | ⬜ pending |
| 07-02-02 | 02   | 1    | DECI-02           | unit      | `pnpm vitest run tests/unit/stores/decisionStore.test.ts`                                            | ⬜ W0       | ⬜ pending |
| 07-02-03 | 02   | 1    | DIGE-01 / DIGE-02 | component | `pnpm vitest run tests/components/OfflineDigestPanel.test.ts tests/components/DecisionPanel.test.ts` | ⬜ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [x] `tests/unit/stores/digestStore.test.ts` — add test: `initializeDigest` preserves hydrated entries when `sourceEvents` is empty and `lastOfflineAt` is set
- [x] `tests/unit/stores/digestStore.test.ts` — add test: `buildDigestSession` does not overwrite hydrated entries with empty materialization
- [x] `tests/unit/stores/decisionStore.test.ts` — add test: `hydrateCards` only materializes digest-backed suggestions from the latest session
- [x] `tests/unit/stores/decisionStore.test.ts` — add test: stale digest entries from older sessions do not generate new suggestion cards
- [x] `tests/components/OfflineDigestPanel.test.ts` — add test: remounting panel after unmount shows previously persisted entries (not empty state)
- [x] `tests/components/DecisionPanel.test.ts` — add test: digest-backed suggestions are visible when digest entries exist in persistence

---

## Manual-Only Verifications

| Behavior                                                                 | Requirement | Why Manual                                                        | Test Instructions                                                                                                                                   |
| ------------------------------------------------------------------------ | ----------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Digest entries survive real app restart and reappear on Knowledge reopen | DIGE-01     | Requires real Dexie persistence in a running app                  | Open Knowledge panel, view digest, close app, reopen, navigate to Knowledge — entries should still be visible                                       |
| Digest-backed decision suggestions reflect only the current away-window  | DECI-02     | Requires real offline/online transition with actual Matrix events | Go offline, receive messages, come back online, open Knowledge → Digest, then switch to Decision — suggestions should match current session entries |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
