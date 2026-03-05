---
phase: 02
slug: defer-and-message-to-task-loop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 + Vue Test Utils ^2.4.6 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm test:unit -- tests/unit/stores/taskStore.test.ts` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:unit -- tests/unit/stores/taskStore.test.ts tests/unit/stores/deferStore.test.ts`
- **After every plan wave:** Run `pnpm test:unit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | INBX-04 | unit + component | `pnpm test:unit -- tests/unit/stores/deferStore.test.ts -t "create deferred item"` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | INBX-05 | unit + component | `pnpm test:unit -- tests/components/DeferQueuePanel.test.ts -t "move completed archived to history"` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | TASK-01 | component | `pnpm test:unit -- tests/components/MessageActionBar.test.ts -t "create task from message"` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | TASK-02 | integration | `pnpm test:unit -- tests/components/TaskPanel.test.ts -t "jump to source message"` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | TASK-03 | unit + component | `pnpm test:unit -- tests/unit/stores/taskStore.test.ts -t "transition task status"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/stores/deferStore.test.ts` — covers INBX-04/INBX-05
- [ ] `tests/unit/stores/taskStore.test.ts` — covers TASK-03
- [ ] `tests/components/MessageActionBar.test.ts` — covers TASK-01 entry action
- [ ] `tests/components/TaskPanel.test.ts` — covers TASK-02/TASK-03 UI flow
- [ ] `tests/components/DeferQueuePanel.test.ts` — covers INBX-04/INBX-05 UI flow

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| defer 到期提醒与主队列排序体感 | INBX-04 | 时区与 UI 交互时序体感难由单测完全覆盖 | 本地 `pnpm dev`，创建不同预设 defer，观察到期排序与提醒行为 |
| 任务回跳源消息的上下文可感知性 | TASK-02 | 真实数据下滚动定位体验需人工确认 | 在任务面板点击回跳，确认到目标消息并看到前后文，且 query 清理 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
