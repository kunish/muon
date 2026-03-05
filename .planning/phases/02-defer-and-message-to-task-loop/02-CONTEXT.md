# Phase 2: Defer and Message-to-Task Loop - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段只交付：defer 队列（提醒、完成/归档）与消息转任务闭环（创建任务、任务状态流转、回跳源消息）。
不扩展到检索、摘要、决策沉淀等后续阶段能力。

</domain>

<decisions>
## Implementation Decisions

### Defer 提醒策略
- defer 使用「快捷预设 + 自定义时间」模式。
- 预设应覆盖高频场景（如 1 小时后、今晚、明早、明天），并允许手动选择具体时间。

### Defer 队列排序
- defer 队列默认按「到期时间」排序（最早到期在前）。

### Defer 动作入口
- defer 动作同时提供两个入口：
  - 收件箱项内可直接 defer
  - 消息操作菜单（More）内可 defer

### 完成/归档后的可见性
- defer 队列中「完成/归档」项默认从主队列移除。
- 完成/归档项进入历史视图，不干扰主队列待处理项。

### Claude's Discretion
- 快捷预设的精确文案与默认时间点（本地时区边界处理）。
- 历史视图的承载方式（独立 tab、折叠区或抽屉）。
- 到期/逾期在列表中的视觉提示细节。
- 未在本次讨论中展开的任务面板信息密度与回链微交互（保持 Phase 2 边界内由 Claude 决策）。

</decisions>

<specifics>
## Specific Ideas

- 主队列只保留待处理事项，避免被完成/归档信息淹没。
- defer 不应强迫每次手动填日期时间，优先高频快捷操作。

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/features/chat/components/UnifiedInboxPanel.vue`：已具备收件箱列表与批处理交互，可直接扩展 defer 入口。
- `src/features/chat/components/MessageActionBar.vue`：已有 More 菜单结构，可挂载“转任务 / defer”动作。
- `src/features/chat/components/ThreadInboxPanel.vue`：可复用侧栏列表展示风格，承载 defer 队列或任务面板。
- `src/features/chat/stores/chatStore.ts`：Set + action 的交互状态模式已稳定，可复用在任务选择/状态切换。

### Established Patterns
- 事件驱动 + composable 派生列表（Phase 1 `useUnifiedInbox`）已建立，适合 defer/task 列表继续沿用。
- 跳转链路采用「预加载上下文 + 路由 query 定位」模式（`loadInboxEventContext` + `focusEventId`）。
- UI 交互偏“侧边栏就地处理”，避免频繁切页。

### Integration Points
- `ChannelSidebar.vue`：Phase 1 已挂载 UnifiedInboxPanel，可继续扩展 defer/task 快捷入口。
- `MessageList.vue`：已支持 `focusEventId` 落位，任务回链可复用现有定位机制。
- `src/matrix/inbox.ts`：已有上下文加载 API，可复用于任务回跳前的数据预加载。

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-defer-and-message-to-task-loop*
*Context gathered: 2026-03-05*
