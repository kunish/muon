---
phase: 02-defer-and-message-to-task-loop
plan: "01"
subsystem: api
tags: [pinia, vitest, state-machine, localstorage, contracts]

requires:
  - phase: 01-unified-inbox-triage
    provides: inbox 项来源与消息上下文跳转链路
provides:
  - defer/task 领域合同（types）
  - deferStore 持久化与 active/history 状态机
  - taskStore 持久化与 todo/doing/done 受控流转
affects: [phase-02-ui, phase-03-retrieval]

tech-stack:
  added: []
  patterns: [versioned localStorage key, store-action-only transition, typed domain contract]

key-files:
  created: [src/features/chat/types/defer.ts, src/features/chat/types/task.ts, src/features/chat/stores/deferStore.ts, src/features/chat/stores/taskStore.ts, tests/unit/stores/deferStore.test.ts, tests/unit/stores/taskStore.test.ts]
  modified: []

key-decisions:
  - "defer/task 统一使用 versioned storage key（muon:defer:v1 与 muon:task:v1）以支持后续迁移"
  - "任务状态迁移集中在 taskStore action，禁止组件直接改写 status"

patterns-established:
  - "Pattern 1: 状态机规则先由 Vitest 固化，再由 store 实现满足"
  - "Pattern 2: hydrate 需容错并过滤无效 schema/脏数据"

requirements-completed: [INBX-04, INBX-05, TASK-01, TASK-03]

duration: 1 min
completed: 2026-03-05
---

# Phase 2 Plan 1: Defer/Task 合同与状态机基线 Summary

**交付了 defer 与 task 的统一类型合同、可持久化 Pinia 状态机和对应单测基线，后续 UI 可直接消费 store action 无需再定义核心规则。**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-05T10:59:14Z
- **Completed:** 2026-03-05T11:01:08Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- 固化 defer/task 领域合同（含 sourceRef、状态联合类型、versioned storage key）。
- 建立 deferStore 的 active/history 分流、完成/归档迁移与持久化恢复容错。
- 建立 taskStore 的创建/更新/状态流转与按状态分组派生能力。

## Task Commits

Each task was committed atomically:

1. **Task 1: 定义 defer/task 接口合同并建立 Wave 0 测试骨架** - `50afe5f` (test), `495b557` (feat)
2. **Task 2: 实现 deferStore（提醒、排序字段、完成/归档流转）** - `5472a4c` (test), `01eed94` (feat)
3. **Task 3: 实现 taskStore（任务创建与 todo/doing/done 状态机）** - `7061bd8` (test), `9407cb3` (feat)

**Plan metadata:** （待本次执行提交）

## Files Created/Modified
- `src/features/chat/types/defer.ts` - defer 领域合同、默认状态与状态迁移辅助。
- `src/features/chat/types/task.ts` - task 合同、sourceRef 结构与状态迁移约束。
- `src/features/chat/stores/deferStore.ts` - defer 状态机、提醒时间解析、持久化 hydrate。
- `src/features/chat/stores/taskStore.ts` - task 创建/更新/流转与状态分组。
- `tests/unit/stores/deferStore.test.ts` - defer store 行为测试（创建、过滤、迁移、恢复）。
- `tests/unit/stores/taskStore.test.ts` - task store 行为测试（字段约束、流转、分组、恢复）。

## Decisions Made
- 使用版本化 localStorage key，确保后续 schema 升级可控。
- 将状态迁移规则收敛到 store action，避免组件层状态漂移。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 02-01 所需 contracts/store/test 基线均可用。
- 可继续补齐 02-02（defer UI 闭环）并复用现有 store action。

---
*Phase: 02-defer-and-message-to-task-loop*
*Completed: 2026-03-05*

## Self-Check: PASSED

- FOUND: .planning/phases/02-defer-and-message-to-task-loop/02-01-SUMMARY.md
- FOUND: 50afe5f
- FOUND: 495b557
- FOUND: 5472a4c
- FOUND: 01eed94
- FOUND: 7061bd8
- FOUND: 9407cb3
