---
phase: 03
slug: cross-conversation-retrieval
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                      |
| ---------------------- | ------------------------------------------ |
| **Framework**          | Vitest ^4.0.18 + Playwright ^1.58.2        |
| **Config file**        | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command**  | `pnpm test:unit`                           |
| **Full suite command** | `pnpm test`                                |
| **Estimated runtime**  | ~120 seconds                               |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run tests/unit/matrix/retrieval.test.ts`
- **After every plan wave:** Run `pnpm test:unit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command                                                               | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------- | ------------------------------------------------------------------------------- | ----------- | ---------- |
| 03-01-01 | 01   | 1    | RETR-01     | unit      | `pnpm vitest run tests/unit/matrix/retrieval.test.ts -t "cross-room search"`    | ❌ W0       | ⬜ pending |
| 03-01-02 | 01   | 1    | RETR-02     | unit      | `pnpm vitest run tests/unit/matrix/retrieval.test.ts -t "joined-room scope"`    | ❌ W0       | ⬜ pending |
| 03-02-01 | 02   | 2    | RETR-01     | component | `pnpm vitest run tests/components/GlobalSearch.test.ts -t "jump to result"`     | ❌ W0       | ⬜ pending |
| 03-02-02 | 02   | 2    | RETR-02     | component | `pnpm vitest run tests/components/GlobalSearch.test.ts -t "exclude left rooms"` | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `tests/unit/matrix/retrieval.test.ts` — covers RETR-01/RETR-02 query transform, pagination, and room scoping
- [ ] `tests/components/GlobalSearch.test.ts` — covers result rendering and click-to-jump behavior
- [ ] `tests/mocks/matrix-search.ts` — deterministic search payloads (`rank`, `next_batch`, mixed membership rooms)

---

## Manual-Only Verifications

| Behavior                         | Requirement | Why Manual                       | Test Instructions                                                       |
| -------------------------------- | ----------- | -------------------------------- | ----------------------------------------------------------------------- |
| 检索体验在真实数据下的相关性体感 | RETR-01     | 相关性主观感受难以完全自动化量化 | 启动 `pnpm dev`，跨 3+ 会话输入关键词，确认结果排序符合预期且可分页加载 |
| 加密房间检索缺失提示可理解       | RETR-02     | 文案可理解性需人工验证           | 在含 E2EE 房间环境搜索已知关键词，确认无越权结果且提示语清晰            |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
