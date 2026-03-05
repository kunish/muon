---
phase: 01-unified-inbox-triage
plan: "03"
subsystem: ui
tags: [vue, pinia, matrix, inbox]
requires:
  - phase: 01-01
    provides: unified inbox data contracts/store/composable
  - phase: 01-02
    provides: loadInboxEventContext API
provides:
  - Unified inbox panel with filter and batch processed UX
  - DM sidebar integration for inbox jump entry
  - Message list focusEventId定位与落位后清理 query
affects: [phase-1-verification, inbox-triage]
tech-stack:
  added: []
  patterns: ["sidebar preloads context before navigation", "focusEventId query-driven message focus"]
key-files:
  created:
    - src/features/chat/components/UnifiedInboxPanel.vue
    - tests/components/UnifiedInboxPanel.test.ts
  modified:
    - src/features/server/components/ChannelSidebar.vue
    - src/features/chat/components/MessageList.vue
    - src/locales/en.json
    - src/locales/zh.json
key-decisions:
  - "统一收件箱入口放在 DM 侧边栏，减少用户跨页面切换"
  - "跳转前预加载 context，失败时仍允许降级导航"
patterns-established:
  - "通过 focusEventId query 驱动目标消息定位并在成功后清理 query"
requirements-completed: [INBX-01, INBX-02, INBX-03]
duration: 16min
completed: 2026-03-05
---

# Phase 1 Plan 03: Unified Inbox UI + Jump Chain Summary

**交付统一收件箱可见交互与跳转闭环：用户可筛选/批处理事项，并从 DM 侧边栏一键跳到源消息位置。**

## Performance

- **Duration:** 16 min
- **Started:** 2026-03-05T15:00:00Z
- **Completed:** 2026-03-05T15:16:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- 新增 `UnifiedInboxPanel`，支持 all/mention/priority-unread/reply-needed 过滤
- 提供多选与批量 processed 按钮，接入既有 inboxStore
- 在 DM 侧边栏挂载 inbox 面板并接通 jump 事件
- 跳转链路先调用 `loadInboxEventContext`，再带 `focusEventId` 导航
- `MessageList` 增加 query 驱动定位逻辑，定位后自动清理 query

## Task Commits

1. **Task 1: 实现 UnifiedInboxPanel 组件与交互测试** - `fe07551` (feat)
2. **Task 2: 在 DM 侧边栏接入收件箱并打通源消息跳转** - `787bb61` (feat)

## Files Created/Modified
- `src/features/chat/components/UnifiedInboxPanel.vue` - inbox 列表/过滤/批处理 UI
- `src/features/server/components/ChannelSidebar.vue` - DM 模式挂载 inbox 并处理 jump
- `src/features/chat/components/MessageList.vue` - focusEventId 驱动定位
- `tests/components/UnifiedInboxPanel.test.ts` - 组件行为测试
- `src/locales/en.json` / `src/locales/zh.json` - inbox 文案

## Decisions Made
- 在 DM 侧边栏直出 unified inbox，保证“一个入口”可达性。
- 跳转采用“预加载 context + query 定位”的两段式，兼顾可靠性与 UI 解耦。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `test:unit -- <file>` 触发全量测试**
- **Found during:** Task 1/2 验证阶段
- **Issue:** 计划中的 `pnpm test:unit -- tests/components/UnifiedInboxPanel.test.ts` 会触发无关用例。
- **Fix:** 使用 `pnpm vitest run <target files>` 精确执行本计划测试。
- **Verification:** `UnifiedInboxPanel` + `inbox context` + `inbox store` 目标测试均通过。
- **Committed in:** `fe07551`, `787bb61`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** 仅调整验证方式，不影响功能范围与交付目标。

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Phase 1 的 INBX-01/02/03 已具备实现与测试证据，可进入阶段级目标验证。

## Self-Check: PASSED

- FOUND: `.planning/phases/01-unified-inbox-triage/01-03-SUMMARY.md`
- FOUND: `fe07551`
- FOUND: `787bb61`
