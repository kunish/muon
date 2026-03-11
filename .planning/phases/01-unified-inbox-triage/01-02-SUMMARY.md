---
phase: 01-unified-inbox-triage
plan: "02"
subsystem: matrix
tags: [matrix-js-sdk, timeline, context, inbox]
requires: []
provides:
  - Inbox source-context loader API for target event + surrounding events
  - Matrix timeline-first context retrieval with fallback path
  - INBX-03 unit tests for hit/fallback/error behavior
affects: [phase-01-plan-03, unified-inbox-ui, message-jump]
tech-stack:
  added: []
  patterns: ["getEventTimeline + paginateEventTimeline first", "fallback to SDK/REST context API", "single context loader API for UI"]
key-files:
  created:
    - src/matrix/inbox.ts
    - tests/unit/matrix/inbox.test.ts
  modified:
    - src/matrix/index.ts
    - tests/mocks/matrix.ts
key-decisions:
  - "上下文加载优先走 getEventTimeline + paginateEventTimeline，保证与 SDK timeline 语义一致"
  - "目标事件不在本地 timeline 时，回退到 getEventContext（或 REST /context）避免跳转丢失"
patterns-established:
  - "UI 层只调用 loadInboxEventContext，不直接拼 Matrix context 请求"
requirements-completed: [INBX-03]
duration: 4 min
completed: 2026-03-05
---

# Phase 1 Plan 02: Matrix 上下文加载 Summary

**交付 `loadInboxEventContext` 统一 API，支持目标消息命中与缺失回填两条路径，保证收件箱跳转可获取前后文。**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-05T07:00:00Z
- **Completed:** 2026-03-05T07:04:13Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- 定义 `InboxEventContext` 与 `loadInboxEventContext` 契约并补齐失败测试（接口先行）
- 实现 timeline 优先的上下文加载逻辑（`getEventTimeline` + 双向 `paginateEventTimeline`）
- 实现目标消息缺失时的 fallback（`getEventContext` / REST `/context`）
- 在 `src/matrix/index.ts` 导出 API，供后续 UI 直接复用

## Task Commits

Each task was committed atomically:

1. **Task 1: 写上下文加载契约与失败测试（接口先行）** - `d6d8426` (test)
2. **Task 2: 实现 Matrix context loader 并从 matrix/index 导出** - `0c42d25` (feat)

## Files Created/Modified

- `src/matrix/inbox.ts` - INBX-03 上下文加载入口（timeline + fallback）
- `src/matrix/index.ts` - 对外 re-export `loadInboxEventContext` 与类型
- `tests/unit/matrix/inbox.test.ts` - 覆盖命中/回填/异常三类场景
- `tests/mocks/matrix.ts` - 扩展 context timeline 相关 mock 能力

## Decisions Made

- 先用 timeline API 拿上下文，再在必要时回退 context API，降低“本地窗口缺事件”导致的跳转失败。
- 错误路径统一抛出可识别错误前缀 `Failed to load inbox event context`，方便上层处理。

## Deviations from Plan

None - plan executed exactly as written.

## Authentication Gates

None.

## Issues Encountered

- 执行计划指定命令 `pnpm test:unit -- tests/unit/matrix/inbox.test.ts` 时会触发仓库内无关组件测试（`tests/components/MessageBubble.test.ts`）并因 jsdom canvas/lottie 失败；按范围边界未修复，已记录到 `deferred-items.md`。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

INBX-03 上下文加载能力已就绪，01-03 可直接接入 UI 跳转链路。

## Self-Check: PASSED

- FOUND: `.planning/phases/01-unified-inbox-triage/01-02-SUMMARY.md`
- FOUND: `d6d8426`
- FOUND: `0c42d25`
