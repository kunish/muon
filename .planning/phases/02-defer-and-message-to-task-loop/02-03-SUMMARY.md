---
phase: 02-defer-and-message-to-task-loop
plan: "03"
subsystem: chat
tags: [message-to-task, pinia, vue3, vitest]

requires:
  - phase: 02-01
    provides: task/defer contract and store actions
  - phase: 02-02
    provides: message action bar menu entry patterns
provides:
  - Message-level "convert to task" interaction entry
  - Task composer dialog with assignee/dueAt/status inputs
  - Pending-lock guarded createTask submission from message sourceRef
affects: [task-panel, message-flow, task-tracking]

tech-stack:
  added: []
  patterns: [teleport-dialog, pinia-action-submit, pending-submit-guard]

key-files:
  created:
    - src/features/chat/components/TaskComposerDialog.vue
  modified:
    - src/features/chat/components/MessageActionBar.vue
    - tests/components/MessageActionBar.test.ts

key-decisions:
  - "Task sourceRef is always derived from current message roomId/eventId"
  - "Task creation keeps a pending lock to prevent duplicate submit"

patterns-established:
  - "Message action -> composer dialog -> store action submission"

requirements-completed: [TASK-01]

duration: 14 min
completed: 2026-03-05
---

# Phase 2 Plan 03: Message-to-Task Creation Summary

**消息 More 菜单已支持转任务，并通过 TaskComposerDialog 将 assignee/dueAt/status 与 sourceRef 一次性写入 taskStore。**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-05T10:30:25Z
- **Completed:** 2026-03-05T10:44:19Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- 在消息 More 菜单新增“Convert to task”入口并弹出任务创建弹窗。
- 弹窗提交时将 assignee、dueAt、status 与 sourceRef(roomId/eventId) 写入 createTask。
- 增加 pending 提交锁，防止提交进行中重复创建任务。

## Task Commits

1. **Task 1 (RED): 在消息动作栏补齐 message-to-task 失败测试** - `b11080e` (test)
2. **Task 1 (GREEN): 实现消息转任务链路与弹窗提交** - `00f7289` (feat)

## Files Created/Modified
- `src/features/chat/components/TaskComposerDialog.vue` - 任务创建弹窗，收集标题/负责人/截止时间/状态。
- `src/features/chat/components/MessageActionBar.vue` - More 菜单新增转任务入口并提交到 taskStore。
- `tests/components/MessageActionBar.test.ts` - 覆盖打开弹窗、提交 payload、pending 防重三类行为。

## Decisions Made
- 将 sourceRef 设为不可编辑并由消息上下文强制注入，避免任务与消息来源脱钩。
- 提交流程统一走组件内 pending guard + store action，保持 UI 层幂等。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- RED 阶段初次失败为 `taskStore` 导入缺失（符合“先失败再实现”的 TDD 预期）。
- 由于 Teleport 渲染，测试提交路径改为直接触发 TaskComposerDialog 的 submit 事件以稳定断言。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- message-to-task 创建链路已闭环，可继续推进任务状态流转与回跳源消息能力。
- 已满足 TASK-01 字段约束，为后续 TASK-02/TASK-03 提供稳定输入端。

## Self-Check: PASSED

- FOUND: .planning/phases/02-defer-and-message-to-task-loop/02-03-SUMMARY.md
- FOUND: b11080e
- FOUND: 00f7289
