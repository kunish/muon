---
phase: 02-defer-and-message-to-task-loop
plan: "04"
subsystem: ui
tags: [vue, pinia, vitest, task-panel, message-jump]
requires:
  - phase: 02-03
    provides: message-to-task creation and task domain model
provides:
  - TaskPanel 三栏任务执行面板（todo/doing/done）
  - 任务回跳源消息链路（loadInboxEventContext + focusEventId）
  - DM Sidebar 任务面板入口与 ChatWindow 侧栏协同
affects: [phase-02-verification, task-execution-loop, message-jump]
tech-stack:
  added: []
  patterns: ["single side-panel state key for tasks", "preload context then query-focus navigation", "graceful fallback on preload failure"]
key-files:
  created:
    - src/features/chat/components/TaskPanel.vue
    - src/features/chat/stores/taskStore.ts
    - tests/components/TaskPanel.test.ts
  modified:
    - src/features/chat/components/ChatWindow.vue
    - src/features/chat/stores/chatStore.ts
    - src/features/server/components/ChannelSidebar.vue
    - src/locales/en.json
    - src/locales/zh.json
key-decisions:
  - "任务回跳严格复用 Phase 1 既有链路：loadInboxEventContext 预加载 + focusEventId 定位"
  - "预加载失败仅告警并继续导航，避免阻断执行链路"
  - "任务面板入口统一挂在既有 side panel 状态机，不新增平行页面或状态机制"
patterns-established:
  - "Pattern: 任务执行与消息回跳复用同一侧栏容器（activeSidePanel === 'tasks'）"
  - "Pattern: 回跳动作必须先尝试上下文预加载，失败降级后仍路由到目标会话"
requirements-completed: [TASK-02, TASK-03]
duration: 19 min
completed: 2026-03-05
---

# Phase 2 Plan 04: Task Panel Execution + Jump Chain Summary

**交付任务执行闭环面板：用户可在 todo/doing/done 三态流转任务，并从任务卡一键回到源消息上下文。**

## Performance

- **Duration:** 19 min
- **Started:** 2026-03-05T10:25:20Z
- **Completed:** 2026-03-05T10:44:49Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- 新增 `TaskPanel`，按 todo/doing/done 分栏渲染并通过 `taskStore.transitionStatus` 执行状态流转。
- `ChatWindow` 挂载任务侧边面板，`chatStore.activeSidePanel` 扩展 `'tasks'` 状态。
- 新增“Jump to source”动作，先调用 `loadInboxEventContext(roomId, eventId)`，再携带 `focusEventId` 导航。
- 预加载失败时仅告警并降级导航，保证任务回跳链路不断。
- 在 `ChannelSidebar`（DM 模式）补齐任务入口，确保用户可达任务面板。

## Task Commits

1. **Task 1 (RED): 实现三态流转测试先行** - `79a6ff6` (test)
2. **Task 1 (GREEN): 交付 TaskPanel 三态流转与侧栏接入** - `9407cb3` (feat)
3. **Task 2 (RED): 回跳链路测试先行** - `9c715a4` (test)
4. **Task 2 (GREEN): 交付回跳源消息 + Sidebar 协同入口** - `4261441` (feat)

## Files Created/Modified

- `src/features/chat/components/TaskPanel.vue` - 任务三栏渲染、状态流转、回跳动作
- `src/features/chat/stores/taskStore.ts` - 任务持久化、状态机与流转动作
- `src/features/chat/components/ChatWindow.vue` - 任务面板挂载点
- `src/features/chat/stores/chatStore.ts` - side panel 状态扩展为 `'tasks'`
- `src/features/server/components/ChannelSidebar.vue` - DM 场景任务入口触发
- `tests/components/TaskPanel.test.ts` - 流转与回跳成功/降级路径测试
- `src/locales/en.json`, `src/locales/zh.json` - 任务面板与回跳文案

## Decisions Made

- 沿用 Phase 1 的消息定位链路，不新增第二套定位机制，避免行为分裂。
- 把“任务入口”接入既有侧栏状态机，保持交互一致性与可维护性。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 测试中对 `@matrix/index` 的全量 mock 破坏了 ChatWindow 依赖**

- **Found during:** Task 2（整体验证阶段）
- **Issue:** 仅暴露 `loadInboxEventContext` 的 mock 导致 `useTyping` 依赖的 `matrixEvents` 丢失。
- **Fix:** 改为 partial mock（保留原模块导出，仅覆盖 `loadInboxEventContext`）。
- **Files modified:** `tests/components/TaskPanel.test.ts`
- **Verification:** `pnpm vitest run tests/components/TaskPanel.test.ts -t "transition task status|jump to source message"` 通过。
- **Committed in:** `4261441`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** 仅修复测试阻塞，不改变功能范围与交付目标。

## Authentication Gates

None.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

TASK-02 / TASK-03 所需的执行流转与回跳闭环均已具备自动化测试与实现证据，可进入 Phase 2 末端整体验证。

## Self-Check: PASSED

- FOUND: `.planning/phases/02-defer-and-message-to-task-loop/02-04-SUMMARY.md`
- FOUND: `79a6ff6`
- FOUND: `9407cb3`
- FOUND: `9c715a4`
- FOUND: `4261441`
