---
phase: 04
slug: offline-digest-and-decision-capture
status: draft
nyquist_compliant: true
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
| **Quick run command** | `pnpm vitest run <task-scoped files/tests>` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds task-scoped / ~120 seconds full suite |

---

## Sampling Rate

- **After every task commit:** Run the task-scoped `pnpm vitest run ...` command from the map below
- **After every plan wave:** Run `pnpm test:unit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | DIGE-01, DECI-01 | unit | `pnpm vitest run tests/unit/stores/knowledgeDb.test.ts -t "CitationRef|query" -x` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | DIGE-02, DECI-02, DECI-03 | unit + component | `pnpm vitest run tests/unit/stores/knowledgeDb.test.ts tests/components/KnowledgeCapturePanel.test.ts -t "pending|tab|activeTab" -x` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | DIGE-01, DIGE-03 | unit + component | `pnpm vitest run tests/unit/stores/digestStore.test.ts tests/components/OfflineDigestPanel.test.ts -t "away-window|relevance|pinned" -x` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | DIGE-02 | component | `pnpm vitest run tests/components/OfflineDigestPanel.test.ts -t "citation" -x` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 3 | DECI-01 | unit + component | `pnpm vitest run tests/unit/stores/decisionStore.test.ts tests/components/DecisionPanel.test.ts -t "createDecisionCard|linked message" -x` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 3 | DECI-02 | unit | `pnpm vitest run tests/unit/stores/decisionStore.test.ts -t "extractSuggestions|suggestion disposition" -x` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 2 | DECI-03 | unit + component | `pnpm vitest run tests/unit/services/crossSessionQa.test.ts tests/components/CrossSessionQaPanel.test.ts -t "citations|joined-room|fallback" -x` | ❌ W0 | ⬜ pending |
| 04-04-02 | 04 | 2 | DECI-03 | component | `pnpm vitest run tests/components/CrossSessionQaPanel.test.ts -t "citation" -x` | ❌ W0 | ⬜ pending |
| 04-05-01 | 05 | 4 | DIGE-01, DECI-01, DECI-03 | component | `pnpm vitest run tests/components/KnowledgeCapturePanel.integration.test.ts -t "tabs|mount" -x` | ❌ W0 | ⬜ pending |
| 04-05-02 | 05 | 4 | DIGE-02, DECI-02 | component | `pnpm vitest run tests/components/KnowledgeCapturePanel.integration.test.ts -t "knowledge entry|side-panel" -x` | ❌ W0 | ⬜ pending |
| 04-06-01 | 06 | 1 | DIGE-01, DIGE-03 | unit + component | `pnpm vitest run tests/unit/stores/digestStore.test.ts tests/components/OfflineDigestPanel.test.ts` | ✅ existing | ⬜ pending |
| 04-06-02 | 06 | 1 | DIGE-01, DIGE-02, DIGE-03 | unit + component | `pnpm vitest run tests/unit/stores/digestStore.test.ts tests/components/OfflineDigestPanel.test.ts` | ✅ existing | ⬜ pending |
| 04-07-01 | 07 | 1 | DECI-01, DECI-02 | unit + component | `pnpm vitest run tests/unit/services/suggestionExtraction.test.ts tests/unit/stores/decisionStore.test.ts tests/components/DecisionPanel.test.ts` | ❌ W0 | ⬜ pending |
| 04-07-02 | 07 | 1 | DECI-01, DECI-02 | unit + component | `pnpm vitest run tests/unit/services/suggestionExtraction.test.ts tests/unit/stores/decisionStore.test.ts tests/components/DecisionPanel.test.ts` | ❌ W0 | ⬜ pending |
| 04-08-01 | 08 | 1 | DECI-03 | unit + component | `pnpm vitest run tests/unit/stores/qaStore.test.ts tests/unit/services/crossSessionQa.test.ts tests/components/CrossSessionQaPanel.test.ts` | ❌ W0 | ⬜ pending |
| 04-08-02 | 08 | 1 | DECI-03 | unit + component | `pnpm vitest run tests/unit/stores/qaStore.test.ts tests/unit/services/crossSessionQa.test.ts tests/components/CrossSessionQaPanel.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/stores/digestStore.test.ts` — covers DIGE-01, DIGE-03
- [ ] `tests/components/OfflineDigestPanel.test.ts` — covers DIGE-01, DIGE-02
- [ ] `tests/components/KnowledgeCapturePanel.test.ts` — covers shell tab contract from 04-01
- [ ] `tests/unit/stores/decisionStore.test.ts` — covers DECI-01, DECI-02
- [ ] `tests/components/DecisionPanel.test.ts` — covers DECI-01, DECI-02
- [ ] `tests/unit/services/crossSessionQa.test.ts` — covers DECI-03
- [ ] `tests/components/CrossSessionQaPanel.test.ts` — covers DECI-03
- [ ] `tests/components/KnowledgeCapturePanel.integration.test.ts` — covers unified Knowledge entry integration
- [ ] `tests/unit/services/suggestionExtraction.test.ts` — covers DECI-02 extraction contract for gap plan 04-07
- [ ] `tests/unit/stores/qaStore.test.ts` — covers DECI-03 history hydration for gap plan 04-08

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
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
