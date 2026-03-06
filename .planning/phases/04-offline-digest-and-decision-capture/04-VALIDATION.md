---
phase: 04
slug: offline-digest-and-decision-capture
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + Vue Test Utils 2.4.6 + Playwright 1.58.2 |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `pnpm test:unit` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:unit`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | DIGE-01 | unit + component | `pnpm vitest run tests/unit/stores/digestStore.test.ts tests/components/OfflineDigestPanel.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | DIGE-03 | unit | `pnpm vitest run tests/unit/stores/digestStore.test.ts -t "relevance" -x` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | DIGE-02 | component | `pnpm vitest run tests/components/OfflineDigestPanel.test.ts -t "citation" -x` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | DECI-01 | unit + component | `pnpm vitest run tests/unit/stores/decisionStore.test.ts tests/components/DecisionPanel.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 2 | DECI-02 | unit | `pnpm vitest run tests/unit/stores/decisionStore.test.ts -t "suggestion disposition" -x` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 3 | DECI-03 | unit + component | `pnpm vitest run tests/unit/services/crossSessionQa.test.ts tests/components/CrossSessionQaPanel.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/stores/digestStore.test.ts` — covers DIGE-01, DIGE-03
- [ ] `tests/components/OfflineDigestPanel.test.ts` — covers DIGE-01, DIGE-02
- [ ] `tests/unit/stores/decisionStore.test.ts` — covers DECI-01, DECI-02
- [ ] `tests/components/DecisionPanel.test.ts` — covers DECI-01, DECI-02
- [ ] `tests/unit/services/crossSessionQa.test.ts` — covers DECI-03
- [ ] `tests/components/CrossSessionQaPanel.test.ts` — covers DECI-03

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 离线回归摘要的体感可用性（是否“足够精简”） | DIGE-01 | 需要主观判断信息密度和可读性 | 启动 `pnpm dev`，模拟离线后回归，检查摘要数量与内容是否明显压缩且可快速扫读 |
| 引用跳转后的定位体验与信任感 | DIGE-02 | 视觉定位与用户信任感无法完全自动化 | 在 digest/decision/QA 中点击多条 citation，确认均能回跳并定位到目标消息 |
| AI 建议接受/拒绝流程的可理解性 | DECI-02 | 文案与交互语义需人工确认 | 触发建议后依次执行 accept/reject，确认状态变化、时间戳与审计信息清晰可见 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
