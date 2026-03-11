---
phase: 05
slug: reliability-and-performance-consistency
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-06
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | vitest + Vue Test Utils + Playwright                                                                                                                           |
| **Config file**        | `vitest.config.ts`, `playwright.config.ts`                                                                                                                     |
| **Quick run command**  | `pnpm vitest run tests/unit/matrix/syncRecovery.test.ts tests/components/UnifiedInboxPanel.recovery.test.ts tests/components/GlobalSearch.performance.test.ts` |
| **Full suite command** | `pnpm test:unit && pnpm test:e2e`                                                                                                                              |
| **Estimated runtime**  | ~45 seconds                                                                                                                                                    |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run tests/unit/matrix/syncRecovery.test.ts tests/components/UnifiedInboxPanel.recovery.test.ts tests/components/GlobalSearch.performance.test.ts`
- **After every plan wave:** Run `pnpm test:unit && pnpm test:e2e`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command                                                                                                             | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 05-01-01 | 01   | 1    | RELI-01     | unit      | `pnpm vitest run tests/unit/matrix/syncRecovery.test.ts -x`                                                                   | ❌ W0       | ⬜ pending |
| 05-01-02 | 01   | 1    | RELI-01     | component | `pnpm vitest run tests/components/UnifiedInboxPanel.recovery.test.ts tests/unit/stores/taskStore.recovery.test.ts -x`         | ❌ W0       | ⬜ pending |
| 05-02-01 | 02   | 1    | RELI-02     | component | `pnpm vitest run tests/components/UnifiedInboxPanel.performance.test.ts tests/components/GlobalSearch.performance.test.ts -x` | ❌ W0       | ⬜ pending |
| 05-02-02 | 02   | 1    | RELI-02     | smoke     | `pnpm vitest run tests/components/GlobalSearch.performance.test.ts -x`                                                        | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `tests/unit/matrix/syncRecovery.test.ts` — stubs for RELI-01 reconnect and gap reconciliation behavior
- [ ] `tests/components/UnifiedInboxPanel.recovery.test.ts` — reconnect-driven inbox consistency coverage
- [ ] `tests/unit/stores/taskStore.recovery.test.ts` — task persistence continuity through reconnect
- [ ] `tests/components/UnifiedInboxPanel.performance.test.ts` — inbox virtualization / render-budget coverage
- [ ] `tests/components/GlobalSearch.performance.test.ts` — search render-budget and bounded navigation preload coverage
- [ ] `tests/mocks/` recovery fixtures — sync-state and limited-timeline helpers

---

## Manual-Only Verifications

| Behavior                                                                                                                        | Requirement | Why Manual                                                                            | Test Instructions                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Reconnect the desktop client during active inbox/task usage and confirm no visible item loss or duplicate navigation regression | RELI-01     | Real reconnect timing and Matrix server latency are hard to model fully in unit tests | Launch app, simulate disconnect/reconnect, verify inbox/task counts and source-message jump behavior remain consistent |
| Validate inbox/search interactions still feel responsive with realistic room volume                                             | RELI-02     | Perceived lag threshold is experiential even with component budgets                   | Open large workspace fixture, type in search, scroll inbox, and confirm no noticeable typing or navigation lag         |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
