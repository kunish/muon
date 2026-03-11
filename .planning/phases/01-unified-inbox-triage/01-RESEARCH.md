# Phase 1: Unified Inbox Triage - Research

**Researched:** 2026-03-05
**Domain:** Vue 3 + Pinia + Matrix timeline triage workflow
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

1. **priority unread 规则（锁定）**
   - 采用：**高亮或 @提及优先**。
   - 即：以 Matrix highlight / mention 作为优先未读的核心判定。

2. **INBX-02 processed 持久化策略（锁定）**
   - 采用：**本地持久化**（localStorage 或 IndexedDB）。
   - 目标：Phase 1 先保证可用与低风险落地，不做跨设备同步。

### Claude's Discretion

- localStorage 与 IndexedDB 的具体选型、抽象层设计、键命名规范。
- reply-needed 的最小可测试规则（在不引入复杂 NLP 的前提下）。
- inbox item 排序细节（同优先级下按时间/房间等规则）。
- INBX-03 上下文加载在 SDK API 与 REST `/context` 间的调用封装策略。

### Deferred Ideas (OUT OF SCOPE)

- processed 状态跨设备同步（例如 Matrix account data/服务端策略）
- 智能优先级（关键词权重、语义分类、SLA 多维评分）
- 高级动画与复杂收件箱可视化
  </user_constraints>

## Summary

Phase 1 的实现应严格复用当前项目的既有栈与交互骨架：`Vue 3 + Pinia + matrix-js-sdk`，在 `chat` 领域内新增“统一收件箱”聚合层，而不是新建平行消息系统。现有代码已经具备关键底座：`RoomSummary` 中有 `unreadCount/highlightCount`、消息流有 `matrixEvents` 驱动刷新、列表有成熟的批量选择模式（`Set` + store action）、消息时间线具备可分页加载能力。

对 INBX-01/02 的核心建议是：在 `src/features/chat` 下新增 inbox 专属 store + composable（聚合 mentions / priority unread / reply-needed 三类 item），并沿用当前会话列表的“事件驱动刷新 + computed 派生过滤 + 批量 action”模式。对 INBX-03，建议优先走 Matrix 官方的 event context 路径（`getEventTimeline` + `paginateEventTimeline` 或 `/_matrix/client/v3/rooms/{roomId}/context/{eventId}`）来加载目标消息前后文，避免仅靠本地 live timeline 猜测上下文。

**Primary recommendation:** 在 `chat` feature 内增量实现 `UnifiedInbox`（store/composable/view 三层），并以 Matrix 官方 context API 实现“从 inbox 项跳转到源消息+上下文”。

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                              | Research Support                                                                                                                                            |
| ------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INBX-01 | User can view one unified inbox that aggregates mentions, unread priority items, and reply-needed items. | 使用 `RoomSummary.highlightCount/unreadCount` 与事件流刷新（`matrixEvents`）构建聚合来源；新增 triage rule 识别 reply-needed。                              |
| INBX-02 | User can filter inbox items by type and mark selected items as processed in batch.                       | 复用现有 `Set` 批量选择模式（`chatStore.selectedMessages`）与 computed 过滤模式（`useConversations`），新增 inbox 状态标记与批量 processed action。         |
| INBX-03 | User can jump from an inbox item to the source message with surrounding context loaded.                  | 使用 Matrix `getEventTimeline` + `paginateEventTimeline` / `GET /rooms/{roomId}/context/{eventId}` 获取目标事件前后文；避免只依赖本地 `getLiveTimeline()`。 |

</phase_requirements>

## Standard Stack

### Core

| Library       | Version | Purpose                                     | Why Standard                                             |
| ------------- | ------- | ------------------------------------------- | -------------------------------------------------------- |
| vue           | ^3.5.29 | UI 组件与响应式渲染                         | 当前主框架，所有 feature 已基于 Composition API/SFC 构建 |
| pinia         | ^3.0.4  | 跨组件状态管理                              | 现有 chat/server/settings store 都采用同一范式           |
| matrix-js-sdk | ^41.0.0 | 会话摘要、时间线、事件上下文、已读/提醒计数 | 当前消息域核心 SDK，`src/matrix/*` 已封装主要能力        |
| vue-router    | ^5.0.3  | 页面与会话路由                              | 当前 `ChatPage` 通过 route params 驱动 room 切换         |

### Supporting

| Library               | Version  | Purpose              | When to Use                          |
| --------------------- | -------- | -------------------- | ------------------------------------ |
| @tanstack/vue-virtual | ^3.13.19 | 大列表虚拟化         | inbox 项量大、滚动性能下降时启用     |
| date-fns              | ^4.1.0   | 时间分组/展示        | inbox 分组（today/older）与 SLA 展示 |
| zod                   | ^4.3.6   | triage item 结构校验 | inbox item 聚合结果入库/持久化前校验 |

### Alternatives Considered

| Instead of               | Could Use                  | Tradeoff                                  |
| ------------------------ | -------------------------- | ----------------------------------------- |
| Pinia store + composable | 直接组件内局部 state       | 快速但不可复用，难支持批量操作和跨页状态  |
| Matrix context API       | 仅本地 timeline 查找 event | 可能找不到历史上下文；跨分页/断线后不可靠 |

**Installation:**

```bash
pnpm install
```

## Architecture Patterns

### Recommended Project Structure

```text
src/
├── features/chat/
│   ├── components/
│   │   ├── UnifiedInboxPanel.vue      # 收件箱 UI（列表/筛选/批量栏）
│   │   └── InboxItemRow.vue           # 单项渲染
│   ├── composables/
│   │   └── useUnifiedInbox.ts         # 聚合 + 过滤 + 排序
│   └── stores/
│       └── inboxStore.ts              # 选择态、processed 状态、批量 action
└── matrix/
    └── inbox.ts                       # Matrix 侧聚合/上下文加载封装
```

### Pattern 1: 事件驱动刷新 + 派生视图

**What:** 用 `matrixEvents` 触发刷新，UI 只读 computed 结果。
**When to use:** inbox 列表需实时反映 unread/mention/reply-needed 变化时。
**Example:**

```typescript
// Source: src/features/chat/composables/useConversations.ts
for (const evt of LISTENED_EVENTS)
  matrixEvents.on(evt, scheduleRefresh)

const conversations = computed(() => {
  // filter + search + sort derived from source state
})
```

### Pattern 2: Set 驱动批量选择

**What:** 使用 `Set<string>` 表示选中项，提供 enter/exit/toggle action。
**When to use:** INBX-02 批量 processed。
**Example:**

```typescript
// Source: src/features/chat/stores/chatStore.ts
const selectedMessages = reactive(new Set<string>())
function toggleMessageSelection(eventId: string) {
  if (selectedMessages.has(eventId))
    selectedMessages.delete(eventId)
  else selectedMessages.add(eventId)
}
```

### Pattern 3: 目标消息上下文加载

**What:** 先定位目标 event，再补齐前后事件分页。
**When to use:** INBX-03 点击 inbox 项跳转。
**Example:**

```typescript
// Source: matrix-js-sdk docs (MatrixClient)
const timeline = await client.getEventTimeline(room.getUnfilteredTimelineSet(), eventId)
if (timeline)
  await client.paginateEventTimeline(timeline, { backwards: true, limit: 20 })
```

### Anti-Patterns to Avoid

- **在组件内手写三类来源聚合逻辑：** 会导致规则分散、不可测。应集中在 `useUnifiedInbox`/`inboxStore`。
- **仅依赖 `room.getLiveTimeline().getEvents()` 做“跳转上下文”：** 目标消息不在本地窗口时会失败。
- **把 processed 状态只放内存不持久化：** 重连/刷新后用户处理结果丢失。

## Don't Hand-Roll

| Problem        | Don't Build                        | Use Instead                                               | Why                                       |
| -------------- | ---------------------------------- | --------------------------------------------------------- | ----------------------------------------- |
| 上下文查询     | 自己拼 `/messages` 前后 token 流程 | `getEventTimeline` + `paginateEventTimeline` / `/context` | Matrix SDK/规范已定义边界与顺序语义       |
| 未读与提及计数 | 自己维护 message counter 表        | `room.getUnreadNotificationCount(Total/Highlight)`        | 计数受 receipts/push rules 影响，手写易错 |
| 批量选择容器   | 数组 + index 同步                  | `Set` + action API                                        | O(1) 增删查，语义清晰，现有代码已验证     |
| 列表性能优化   | 手写虚拟滚动                       | `@tanstack/vue-virtual`                                   | 现成且已在依赖内，减少渲染边界 bug        |

**Key insight:** 本阶段复杂度主要在“状态一致性与上下文正确性”，不是 UI 组件本身；应最大化复用 SDK 与现有架构。

## Common Pitfalls

### Pitfall 1: “回复待办”规则过于主观

**What goes wrong:** reply-needed 项目误报/漏报，列表噪声高。
**Why it happens:** 没有定义可验证规则（例如提问句、@我后未回复、超时未回）。
**How to avoid:** 在 Phase 1 明确定义最小规则集与优先级；把规则集中到单一函数并单测。
**Warning signs:** 用户频繁手工忽略同类 item。

### Pitfall 2: 跳转只做路由不做上下文回填

**What goes wrong:** 能进房间但看不到目标消息周边。
**Why it happens:** 仅设置 `currentRoomId`，未加载 event 所在 timeline。
**How to avoid:** 跳转流程必须包含“定位 event -> 回填前后文 -> 滚动定位”。
**Warning signs:** 点击 inbox 项后只落在房间底部。

### Pitfall 3: 直接操作 store 破坏可追踪性

**What goes wrong:** 批量 processed 状态在不同组件不一致。
**Why it happens:** 绕过 action 直接改 reactive 容器。
**How to avoid:** 所有写操作经 store action；组件仅读取 refs/computed。
**Warning signs:** 相同 item 在不同面板状态不一致。

### Pitfall 4: 依赖已弃用 timeline 属性

**What goes wrong:** 升级 SDK 后行为漂移。
**Why it happens:** 混用 `room.timeline`（deprecated）与 `getLiveTimeline().getEvents()`。
**How to avoid:** 新 inbox 代码统一使用非 deprecated API。
**Warning signs:** 同房间事件顺序在不同入口不一致。

## Code Examples

Verified patterns from official/project sources:

### 聚合 unread + mention 基础字段

```typescript
// Source: src/matrix/rooms.ts
const highlightCount = room.getUnreadNotificationCount(NotificationCountType.Highlight) || 0
const unreadCount = room.getUnreadNotificationCount(NotificationCountType.Total) || 0
```

### 过滤与排序派生

```typescript
// Source: src/features/chat/composables/useConversations.ts
const conversations = computed(() => {
  let list = rooms.value
  if (store.activeFilter === 'unread')
    list = list.filter(r => r.unreadCount > 0 || store.isMarkedUnread(r.roomId))
  return list
})
```

### Matrix 事件上下文 API（规范）

```http
GET /_matrix/client/v3/rooms/{roomId}/context/{eventId}?limit=10
```

返回 `event`, `events_before`, `events_after`, `start`, `end`，可用于前后文展示与后续分页。

## State of the Art

| Old Approach                    | Current Approach                           | When Changed                                   | Impact                               |
| ------------------------------- | ------------------------------------------ | ---------------------------------------------- | ------------------------------------ |
| 使用 `room.timeline` 直接读列表 | 使用 `room.getLiveTimeline().getEvents()`  | matrix-js-sdk 文档已标注 `timeline` deprecated | 更稳定的 timeline 语义，减少升级风险 |
| 仅本地事件窗口跳转              | 基于 context/event timeline 拉取目标前后文 | Matrix 规范长期提供 `/context`                 | 跳转可靠性显著提升                   |

**Deprecated/outdated:**

- `Room.timeline`：文档标记 deprecated，建议使用 `getLiveTimeline().getEvents()`。

## Open Questions

1. **reply-needed 的最小规则边界**
   - What we know: 需覆盖“需要回复”类 triage。
   - What's unclear: 是否仅基于 `@me + 我方未回复`，是否纳入问句启发式。
   - Recommendation: Phase 1 先定义可单测的 deterministic 规则（优先 `@me + 未回复`），其余启发式延后。

## Validation Architecture

### Test Framework

| Property           | Value                                                    |
| ------------------ | -------------------------------------------------------- |
| Framework          | Vitest ^4.0.18 + Vue Test Utils ^2.4.6                   |
| Config file        | `vitest.config.ts`                                       |
| Quick run command  | `pnpm test:unit -- tests/unit/stores/inboxStore.test.ts` |
| Full suite command | `pnpm test`                                              |

### Phase Requirements → Test Map

| Req ID  | Behavior                                       | Test Type                           | Automated Command                                                                               | File Exists? |
| ------- | ---------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------- | ------------ |
| INBX-01 | 聚合 mentions/unread/reply-needed 到统一 inbox | unit                                | `pnpm test:unit -- tests/unit/stores/inboxStore.test.ts -t "aggregates unified inbox items"`    | ❌ Wave 0    |
| INBX-02 | 按类型过滤 + 批量 processed                    | unit                                | `pnpm test:unit -- tests/unit/stores/inboxStore.test.ts -t "filters and batch processes"`       | ❌ Wave 0    |
| INBX-03 | 点击 item 跳转并加载上下文                     | integration (component+matrix mock) | `pnpm test:unit -- tests/components/UnifiedInboxPanel.test.ts -t "jump to source with context"` | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `pnpm test:unit -- tests/unit/stores/inboxStore.test.ts`
- **Per wave merge:** `pnpm test:unit`
- **Phase gate:** `pnpm test` 全绿后再进入 `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/stores/inboxStore.test.ts` — covers INBX-01/INBX-02
- [ ] `tests/components/UnifiedInboxPanel.test.ts` — covers INBX-03
- [ ] `tests/mocks/matrix.ts` 扩展 context/eventTimeline mock

## Sources

### Primary (HIGH confidence)

- Project source: `package.json`, `vite.config.ts`, `vitest.config.ts`
- Project source: `src/features/chat/stores/chatStore.ts`, `src/features/chat/composables/useConversations.ts`, `src/matrix/rooms.ts`, `src/matrix/messages.ts`
- Matrix JS SDK API docs: `https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#geteventtimeline`（method metadata）
- Matrix JS SDK API docs: `https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#paginateeventtimeline`（method metadata）
- Matrix JS SDK API docs: `https://matrix-org.github.io/matrix-js-sdk/classes/matrix.Room.html#getunreadnotificationcount`
- Matrix Spec v1.17: `https://spec.matrix.org/v1.17/client-server-api/#get_matrixclientv3roomsroomidcontexteventid`

### Secondary (MEDIUM confidence)

- Pinia Core Concepts: `https://pinia.vuejs.org/core-concepts/`
- Vue Style Guide (essential rules, marked outdated but仍可作基础约束): `https://vuejs.org/style-guide/rules-essential.html`

### Tertiary (LOW confidence)

- Exa 聚合结果中的社区文章与 issue 讨论（仅作风险提示，不作规范依据）

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** - 来自项目 `package.json` 与现有目录结构
- Architecture: **HIGH** - 来自当前 chat feature 的既有实现模式
- Pitfalls: **MEDIUM** - 部分来自 SDK 文档 + 现有代码缺口推断

**Research date:** 2026-03-05
**Valid until:** 2026-04-04
