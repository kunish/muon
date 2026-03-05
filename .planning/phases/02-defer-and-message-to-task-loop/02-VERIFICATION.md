---
phase: 02-defer-and-message-to-task-loop
verified: 2026-03-05T12:03:03Z
status: gaps_found
score: 14/15 must-haves verified
re_verification:
  previous_status: human_needed
  previous_score: 14/14
  gaps_closed: []
  gaps_remaining:
    - "真实测试反馈无法滚动，导致 defer 队列核心交互不可完成"
  regressions: []
gaps:
  - truth: "用户可以在真实 UI 中滚动 defer 相关列表并访问全部事项完成处理"
    status: failed
    reason: "人工验证已确认“无法滚动”，当前布局未为 defer 队列提供可用滚动容器，导致长列表时无法触达全部事项。"
    artifacts:
      - path: "src/features/server/components/ChannelSidebar.vue"
        issue: "DM 模式下 `UnifiedInboxPanel` 与 `DeferQueuePanel` 作为固定块堆叠在 `ScrollArea` 之外，无法随队列增长提供统一滚动。"
      - path: "src/features/chat/components/UnifiedInboxPanel.vue"
        issue: "根节点使用 `h-full`（第 92 行）作为侧栏子块会抢占高度，叠加其他块后更易触发可视区域溢出。"
      - path: "src/features/chat/components/DeferQueuePanel.vue"
        issue: "Active/History 列表无 `overflow-y-auto` 或高度约束，列表增长后缺少内部滚动能力。"
      - path: "tests/components/DeferQueuePanel.test.ts"
        issue: "缺少滚动可达性/长列表可操作性测试，未覆盖该阻断场景。"
    missing:
      - "为 DM 侧栏的 inbox+defer 区域建立可滚动布局（例如共享滚动容器或明确高度分配）。"
      - "为 DeferQueuePanel 的 Active/History 列表提供内部滚动策略（max-height + overflow-y-auto）并保持操作按钮可达。"
      - "移除或调整 UnifiedInboxPanel 在侧栏场景的 `h-full` 占位策略，避免挤压其他功能区。"
      - "补充组件测试：长列表时仍可滚动并可点击完成/归档。"
---

# Phase 2: Defer and Message-to-Task Loop Verification Report

**Phase Goal:** 用户可以把消息延后处理并转为任务，在执行中随时回到原始对话语境。
**Verified:** 2026-03-05T12:03:03Z
**Status:** gaps_found
**Re-verification:** Yes — 根据真实用户反馈（无法滚动）复核

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | 用户可以创建带提醒时间的 defer 事项并被系统识别 | ✓ VERIFIED | `deferStore.createDeferredItem` 写入 `dueAt/status`（`src/features/chat/stores/deferStore.ts:137-151`）；双入口调用（`UnifiedInboxPanel.vue:62-87`，`MessageActionBar.vue:117-149`） |
| 2 | defer 可从 active 流转到 completed/archived 并从主队列移除 | ✓ VERIFIED（代码层） | `markCompleted/markArchived` + `activeItems/historyItems` 分流（`deferStore.ts:116-128,161-167`） |
| 3 | 用户可从收件箱项直接设置 defer（预设+自定义） | ✓ VERIFIED | Inbox defer 入口及提交（`UnifiedInboxPanel.vue:175-225`） |
| 4 | 用户可从消息 More 菜单执行 defer | ✓ VERIFIED | More 菜单 defer 入口（`MessageActionBar.vue:257-326`） |
| 5 | defer 主队列按最早到期优先显示 | ✓ VERIFIED | `activeItems` 按 `dueAt` 升序（`deferStore.ts:116-121`） |
| 6 | defer 完成/归档项默认从主队列移除并在历史可见 | ✓ VERIFIED（代码层） | History 视图与 store 分流存在（`DeferQueuePanel.vue:98-116`，`deferStore.ts:123-128`） |
| 7 | 任务实体包含 assignee/dueAt/status/sourceRef | ✓ VERIFIED | `TaskItem` 合同与 `createTask` 校验（`types/task.ts:10-19`，`taskStore.ts:126-159`） |
| 8 | 任务状态只能在 todo/doing/done 受控流转 | ✓ VERIFIED | `canTransitionTaskStatus` + `transitionStatus` 校验（`types/task.ts:30-34,50-51`，`taskStore.ts:182-201`） |
| 9 | 用户可从任意消息创建任务（含 assignee/due/status） | ✓ VERIFIED | `MessageActionBar` 打开 `TaskComposerDialog` 并提交 `createTask`（`MessageActionBar.vue:152-185,362-368`） |
| 10 | 用户可在 TaskPanel 中在 todo/doing/done 间流转 | ✓ VERIFIED | 三栏渲染与 move 按钮（`TaskPanel.vue:55-115`） |
| 11 | 用户可从 ChatWindow 侧边面板打开/关闭 TaskPanel | ✓ VERIFIED | `activeSidePanel === 'tasks'` 挂载（`ChatWindow.vue:81`）+ 触发器（`ChannelSidebar.vue:95-97,164-171`） |
| 12 | 用户可从任务详情准确跳回对应源消息 | ✓ VERIFIED | `jumpToSourceMessage` 路由携带 `focusEventId`（`TaskPanel.vue:25-40`） |
| 13 | 任务回跳复用既有 focusEventId 链路，无平行机制 | ✓ VERIFIED | `TaskPanel` 写 query + `MessageList` 监听聚焦（`TaskPanel.vue:35-40`，`MessageList.vue:355-363`） |
| 14 | 上下文预加载失败时仍可完成跳转 | ✓ VERIFIED | `loadInboxEventContext` try/catch 后继续导航（`TaskPanel.vue:28-40`） |
| 15 | 用户可滚动 defer 队列相关列表并完成全量事项处理 | ✗ FAILED | 人工实测反馈“无法滚动”；代码中 `DeferQueuePanel` 列表未设滚动容器（`DeferQueuePanel.vue:55-116`），且 DM 侧栏仅会话列表在 `ScrollArea` 内（`ChannelSidebar.vue:179-185`） |

**Score:** 14/15 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/features/chat/types/defer.ts` | Defer 合同 | ✓ VERIFIED | `DeferStatus/ReminderPreset/DeferItem` 存在 |
| `src/features/chat/types/task.ts` | Task 合同 | ✓ VERIFIED | `TaskStatus/TaskItem/TaskSourceRef` 存在 |
| `src/features/chat/stores/deferStore.ts` | defer 状态机+持久化 | ✓ VERIFIED | create/hydrate/active-history 分流完整 |
| `src/features/chat/stores/taskStore.ts` | task 状态机+持久化 | ✓ VERIFIED | create/update/transition + tasksByStatus |
| `src/features/chat/components/UnifiedInboxPanel.vue` | inbox defer 入口 | ⚠️ PARTIAL | 功能入口存在，但 `h-full` 在侧栏组合布局中增加滚动阻塞风险 |
| `src/features/chat/components/MessageActionBar.vue` | 消息 defer + 转任务入口 | ✓ VERIFIED | defer 与 convert-to-task 入口完整 |
| `src/features/chat/components/DeferQueuePanel.vue` | defer 队列 active/history | ⚠️ PARTIAL | 动作存在，但列表缺少滚动约束/滚动容器 |
| `src/features/chat/components/TaskComposerDialog.vue` | 任务创建表单 | ✓ VERIFIED | assignee/due/status 输入与提交链路在用 |
| `src/features/chat/components/TaskPanel.vue` | 任务三态与回跳 | ✓ VERIFIED | transition + jump-to-source 均实现 |
| `src/features/chat/components/ChatWindow.vue` | TaskPanel 侧栏挂载 | ✓ VERIFIED | `activeSidePanel === 'tasks'` 条件挂载 |
| `src/features/server/components/ChannelSidebar.vue` | DM 入口协同 | ⚠️ PARTIAL | 入口均存在，但 inbox/defer 区域未接入可滚动容器 |
| `tests/components/TaskPanel.test.ts` | 回跳成功/降级覆盖 | ✓ VERIFIED | preload 成功与失败降级均覆盖 |
| `tests/components/DeferQueuePanel.test.ts` | defer 队列行为覆盖 | ⚠️ PARTIAL | 覆盖排序/流转，但未覆盖“长列表可滚动可操作” |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `deferStore.ts` | `types/defer.ts` | typed imports | ✓ WIRED | `import ... from '../types/defer'` |
| `taskStore.ts` | `types/task.ts` | typed imports | ✓ WIRED | `import ... from '../types/task'` |
| `UnifiedInboxPanel.vue` | `deferStore.ts` | `createDeferredItem` | ✓ WIRED | `deferStore.createDeferredItem(...)` |
| `MessageActionBar.vue` | `deferStore.ts` | menu defer action | ✓ WIRED | `createDeferredFromMessage/submitCustomDeferredFromMessage` |
| `ChannelSidebar.vue` | `DeferQueuePanel.vue` | DM sidebar render | ✓ WIRED | `<DeferQueuePanel />` |
| `MessageActionBar.vue` | `taskStore.ts` | `createTask` | ✓ WIRED | `onSubmitTask -> taskStore.createTask(...)` |
| `ChatWindow.vue` | `TaskPanel.vue` | side panel mount | ✓ WIRED | `v-else-if="store.activeSidePanel === 'tasks'"` |
| `TaskPanel.vue` | `taskStore.ts` | `transitionStatus` | ✓ WIRED | `transitionTask -> taskStore.transitionStatus` |
| `TaskPanel.vue` | `src/matrix/inbox.ts` | `loadInboxEventContext` | ✓ WIRED | 跳转前预加载上下文 |
| `TaskPanel.vue` | `MessageList.vue` | `focusEventId` query | ✓ WIRED | query 写入 + watcher 聚焦 |
| `ChannelSidebar.vue` | `UnifiedInboxPanel/DeferQueuePanel` | scroll reachability | ✗ NOT_WIRED | 侧栏滚动仅绑定会话区 `ScrollArea`，defer 区域缺少可达滚动链路 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| INBX-04 | 02-01, 02-02 | User can defer an inbox item with a reminder time and view it in a personal defer queue. | ✗ BLOCKED | defer 创建与展示代码存在，但人工验证确认“无法滚动”，长列表下无法稳定查看/访问全部 defer 项（`ChannelSidebar.vue` + `DeferQueuePanel.vue`） |
| INBX-05 | 02-01, 02-02 | User can mark deferred items as completed or archived from the defer queue. | ✗ BLOCKED | 完成/归档 action 存在，但无法滚动时无法触达非可视项进行处理，核心交互被阻断 |
| TASK-01 | 02-01, 02-03 | User can create a task from any message with assignee, due date, and status fields. | ✓ SATISFIED | `MessageActionBar` -> `TaskComposerDialog` -> `taskStore.createTask`，字段断言见 `MessageActionBar.test.ts:109-144` |
| TASK-02 | 02-04 | User can open a created task and navigate back to the exact source message. | ✓ SATISFIED | `TaskPanel.jumpToSourceMessage` + `focusEventId` 定位链路；测试覆盖成功与降级 |
| TASK-03 | 02-01, 02-04 | User can move tasks across todo, doing, and done states in a task panel. | ✓ SATISFIED | `taskStore.transitionStatus` + `TaskPanel` 三栏操作与测试覆盖 |

**Orphaned requirements check:** REQUIREMENTS.md 中 Phase 2 映射为 `INBX-04/05, TASK-01/02/03`；均已在至少一个 PLAN `requirements` 声明中出现，无 ORPHANED 项。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `src/features/chat/components/UnifiedInboxPanel.vue` | 92 | 在侧栏子块使用 `h-full` | 🛑 Blocker | 与 DM 侧栏多块布局叠加时易造成溢出区不可达，触发“无法滚动” |
| `src/features/chat/components/DeferQueuePanel.vue` | 55-116 | 长列表无滚动容器 | 🛑 Blocker | defer 列表增长后无法访问全部事项，阻断 INBX-04/05 |
| `src/features/server/components/ChannelSidebar.vue` | 179-185 | 仅会话区在 `ScrollArea`，inbox/defer 固定堆叠 | 🛑 Blocker | 关键交互区缺少统一滚动链路 |
| `tests/components/DeferQueuePanel.test.ts` | 1-96 | 未覆盖滚动可达性 | ⚠️ Warning | 回归风险高，易再次出现“看得见逻辑、用不了交互” |

### Human Verification Required

本轮已收到明确人工失败证据（“无法滚动”），不再归类为 `human_needed`，已转为可执行工程缺口（`gaps_found`）。

### Gaps Summary

Phase 2 的 defer 与 task 主链路在代码层大体存在，但“无法滚动”直接阻断 defer 队列的可操作性，导致 INBX-04/INBX-05 在真实使用场景不成立。当前应优先修复侧栏滚动结构与 DeferQueuePanel 列表可滚动性，并补充对应自动化回归测试。

---

_Verified: 2026-03-05T12:03:03Z_  
_Verifier: Claude (gsd-verifier)_
