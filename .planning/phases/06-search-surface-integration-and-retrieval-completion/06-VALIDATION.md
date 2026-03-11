---
phase: 06
slug: search-surface-integration-and-retrieval-completion
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-06
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Vitest 4.0.18 + Vue Test Utils 2.4.6 + Playwright 1.58.2                                                                                                         |
| **Config file**        | `vitest.config.ts`, `playwright.config.ts`                                                                                                                       |
| **Quick run command**  | `pnpm vitest run tests/components/ChatWindow.search.integration.test.ts tests/components/GlobalSearch.performance.test.ts tests/components/GlobalSearch.test.ts` |
| **Full suite command** | `pnpm test:unit && pnpm test:e2e`                                                                                                                                |
| **Estimated runtime**  | ~45 seconds                                                                                                                                                      |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run tests/components/ChatWindow.search.integration.test.ts tests/components/GlobalSearch.performance.test.ts tests/components/GlobalSearch.test.ts`
- **After every plan wave:** Run `pnpm test:unit && pnpm test:e2e`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement       | Test Type        | Automated Command                                                                                                              | File Exists | Status     |
| -------- | ---- | ---- | ----------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------- | ---------- |
| 06-01-01 | 01   | 1    | RETR-01 / RETR-02 | integration      | `pnpm vitest run tests/components/ChatWindow.search.integration.test.ts -t "opens real retrieval panel"`                       | ❌ W0       | ⬜ pending |
| 06-01-02 | 01   | 1    | RELI-02           | component        | `pnpm vitest run tests/components/GlobalSearch.performance.test.ts tests/components/GlobalSearch.test.ts -t "bounded preload"` | ✅          | ⬜ pending |
| 06-02-01 | 02   | 1    | RETR-01 / RELI-02 | integration      | `pnpm vitest run tests/components/ChatWindow.search.integration.test.ts tests/components/GlobalSearch.test.ts`                 | ❌ W0       | ⬜ pending |
| 06-02-02 | 02   | 1    | RETR-02           | unit/integration | `pnpm vitest run tests/unit/matrix/retrieval.test.ts tests/components/ChatWindow.search.integration.test.ts -t "joined-room"`  | ✅ / ❌ W0  | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `tests/components/ChatWindow.search.integration.test.ts` — real mount-point coverage for ChatHeader → ChatWindow → search panel → retrieval flow
- [ ] search-panel fixture helpers in existing test support files (reuse current mocks where possible)
- [ ] Ensure bounded preload path is asserted from the reachable mounted panel, not only `GlobalSearch.vue` in isolation

---

## Manual-Only Verifications

| Behavior                                                           | Requirement | Why Manual                                                                        | Test Instructions                                                                                                                                                                |
| ------------------------------------------------------------------ | ----------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real chat search feels responsive under multi-conversation results | RELI-02     | Noticeable lag is experiential and depends on real data volume                    | Open chat search from the production header, search across multiple conversations, paginate, and click a result while preload is slow; confirm navigation stays quick and usable |
| Joined-room scope matches real authorization state                 | RETR-02     | Homeserver membership/visibility behavior must be validated in a live environment | Use an account that has joined and left rooms, run the same keyword search, and confirm results exclude inaccessible rooms                                                       |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 45s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
