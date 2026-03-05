---
phase: 01-unified-inbox-triage
plan: "01"
subsystem: chat
tags: [pinia, vue, inbox, matrix]
requires: []
provides:
  - Unified inbox data contracts
  - Inbox store filtering/selection/batch processed actions
  - Aggregation composable for mention/priority-unread/reply-needed
affects: [unified-inbox-ui, inbox-jump, dm-sidebar]
tech-stack:
  added: []
  patterns: ["Set-driven batch selection", "localStorage processed persistence", "event-driven derived inbox view"]
key-files:
  created:
    - src/features/chat/types/unifiedInbox.ts
    - src/features/chat/stores/inboxStore.ts
    - src/features/chat/composables/useUnifiedInbox.ts
    - tests/unit/stores/inboxStore.test.ts
  modified: []
key-decisions:
  - "priority unread 按 highlight/@mention 规则判定"
  - "processed 状态仅本地持久化，不做跨设备同步"
patterns-established:
  - "Unified inbox item id 使用 type:roomId 形成稳定 processed key"
requirements-completed: [INBX-01, INBX-02]
duration: 22min
completed: 2026-03-05
---

# Phase 1 Plan 01: Unified Inbox 数据层 Summary

**Unified inbox 基础能力已落地：完成三类事项聚合、类型过滤、批量 processed 与本地持久化。**

## Performance

- **Duration:** 22 min
- **Started:** 2026-03-05T14:37:00Z
- **Completed:** 2026-03-05T14:59:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- 新增统一收件箱契约（item/filter/processed state/storage key）
- 实现 `inboxStore`：筛选、选择、批量 processed、持久化恢复
- 实现 `useUnifiedInbox`：mentions / priority-unread / reply-needed 聚合及过滤派生
- 新增单测覆盖 INBX-01/INBX-02 核心行为

## Task Commits

1. **Task 1: 定义 Unified Inbox 接口契约（接口先行）** - `4b074ae` (feat)
2. **Task 2: 以 TDD 实现 inboxStore 与 useUnifiedInbox 核心逻辑** - `bc49642` (feat)

## Files Created/Modified
- `src/features/chat/types/unifiedInbox.ts` - 统一 inbox 类型与持久化常量
- `src/features/chat/stores/inboxStore.ts` - 批量处理与本地持久化 store
- `src/features/chat/composables/useUnifiedInbox.ts` - 三类事项聚合与过滤派生
- `tests/unit/stores/inboxStore.test.ts` - INBX-01/02 测试覆盖

## Decisions Made
- 按锁定约束实现：priority unread 以 highlight/@mention 为核心。
- processed 仅保存在 localStorage，暂不引入同步策略。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 测试命令参数未按预期只执行目标文件**
- **Found during:** Task 2
- **Issue:** `pnpm test:unit -- tests/unit/stores/inboxStore.test.ts` 触发了全量单测，受到现有无关失败用例影响。
- **Fix:** 改用 `pnpm vitest run tests/unit/stores/inboxStore.test.ts` 做目标测试验证。
- **Verification:** 目标测试文件 4 个用例全部通过。
- **Committed in:** `bc49642`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** 无范围扩张，仅修正验证命令以匹配计划意图。

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
已提供统一 inbox 数据层与可复用 API，可直接进入 UI 集成与跳转上下文链路实现。
