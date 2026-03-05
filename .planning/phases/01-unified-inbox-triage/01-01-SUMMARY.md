---
phase: 01-unified-inbox-triage
plan: "01"
subsystem: chat
tags: [pinia, vue, matrix, unified-inbox]
requires: []
provides:
  - Unified inbox contracts for item/filter/processed state
  - Inbox store actions for selection and batch processed
  - Derived composable for mentions/priority-unread/reply-needed
affects: [phase-01-plan-02, phase-01-plan-03, unified-inbox-ui]
tech-stack:
  added: []
  patterns: ["Set-driven selection", "localStorage processed persistence", "event-driven derived inbox aggregation"]
key-files:
  created: []
  modified:
    - src/features/chat/types/unifiedInbox.ts
    - src/features/chat/stores/inboxStore.ts
    - src/features/chat/composables/useUnifiedInbox.ts
    - tests/unit/stores/inboxStore.test.ts
key-decisions:
  - "priority unread 以 Matrix highlight/mention 为核心判定"
  - "processed 仅本地持久化（storage key: muon:inbox:processed:v1）"
patterns-established:
  - "统一 item id 采用 type:roomId，保证 processed key 稳定可恢复"
requirements-completed: [INBX-01, INBX-02]
duration: 3 min
completed: 2026-03-05
---

# Phase 1 Plan 01: Unified Inbox 数据层 Summary

**交付统一收件箱核心数据层：三类事项聚合、类型过滤、批量 processed 与本地持久化恢复。**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T06:59:08Z
- **Completed:** 2026-03-05T07:02:38Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- 定义统一 inbox 契约（item/filter/processed/storage key）
- 实现 inboxStore 的筛选、选择、批量 processed 与持久化
- 实现 useUnifiedInbox 的 mentions / priority-unread / reply-needed 聚合与过滤
- 通过单测验证 INBX-01/INBX-02 关键行为

## Task Commits

Each task was committed atomically:

1. **Task 1: 定义 Unified Inbox 接口契约（接口先行）** - `4b074ae` (feat)
2. **Task 2: 以 TDD 实现 inboxStore 与 useUnifiedInbox 核心逻辑** - `bc49642` (feat)

## Files Created/Modified
- `src/features/chat/types/unifiedInbox.ts` - 统一 inbox 类型与持久化常量
- `src/features/chat/stores/inboxStore.ts` - 选择与批量 processed 的 store action
- `src/features/chat/composables/useUnifiedInbox.ts` - 三类事项聚合、过滤、计数
- `tests/unit/stores/inboxStore.test.ts` - INBX-01/INBX-02 行为验证

## Decisions Made
- priority unread 严格按 highlight/mention 核心规则实现。
- processed 仅使用本地存储，不引入任何跨设备同步逻辑。

## Deviations from Plan

None - plan executed exactly as written.

## Authentication Gates

None.

## Issues Encountered

- 执行 `pnpm test:unit -- tests/unit/stores/inboxStore.test.ts` 时触发了仓库内无关组件测试失败（MessageBubble + canvas/lottie）；按范围边界未处理，已记录到 `deferred-items.md`。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

已具备统一 inbox 数据层接口，可直接进入 01-02 的消息上下文加载链路。

## Self-Check: PASSED

- FOUND: `.planning/phases/01-unified-inbox-triage/01-01-SUMMARY.md`
- FOUND: `4b074ae`
- FOUND: `bc49642`
