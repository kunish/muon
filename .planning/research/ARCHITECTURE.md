# Architecture Research

**Domain:** 桌面端 Matrix 协作客户端（里程碑：chat-efficiency & knowledge-capture 集成）
**Researched:** 2026-03-05
**Confidence:** HIGH

## Standard Architecture

### System Overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│ UI Layer (Vue 3 Feature Components)                                  │
├──────────────────────────────────────────────────────────────────────┤
│ ChatWindow │ ChannelSidebar │ InboxPage* │ TaskPanel* │ DecisionHub* │
│ MessageActionBar(mod) │ SearchMessages(mod) │ DigestCenter*          │
└───────────────┬───────────────────────────────┬───────────────────────┘
                │ Pinia actions/selectors        │ Router navigation
┌───────────────┴───────────────────────────────┴───────────────────────┐
│ Domain State Layer (Pinia + composables)                              │
├──────────────────────────────────────────────────────────────────────┤
│ chatStore(mod) │ serverStore(mod) │ inboxStore* │ taskStore*          │
│ retrievalStore* │ digestStore* │ decisionStore* │ useInboxFeed*        │
└───────────────┬───────────────────────────────┬───────────────────────┘
                │ Matrix events                  │ Local index/cache
┌───────────────┴───────────────────────────────┴───────────────────────┐
│ Integration Layer                                                      │
├──────────────────────────────────────────────────────────────────────┤
│ matrix/events.ts(mod) → emit typed efficiency events*                 │
│ matrix/messages.ts(mod) / rooms.ts(mod) / sync.ts(mod)                │
│ efficiency services* (inbox/task/retrieval/digest/decision)           │
│ Dexie(idb) index adapter* + optional notification adapter*             │
└──────────────────────────────────────────────────────────────────────┘

* = 新增
mod = 修改
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `InboxPage` *(new)* | 汇总 mentions / unreplied / deferred，支持 triage | 路由页 + 虚拟列表 + 批量动作，读 `inboxStore` |
| `MessageActionBar` *(modified)* | 新增 “Defer / 转任务 / 记录决策”入口 | 保持现有 hover actions，新增 emit 到 efficiency actions |
| `TaskPanel` *(new)* | 个人任务队列、状态流转、跳回原消息 | 侧栏面板，读写 `taskStore`，调用 `router + jumpToMessage` |
| `DecisionHub` *(new)* | 决策卡列表/检索（按房间、标签） | 独立页或 side panel，读 `decisionStore` |
| `DigestCenter` *(new)* | 离线回归摘要展示与确认已读 | 启动后弹层/页，基于 `digestStore.computeSince(lastSeenAt)` |

## Recommended Project Structure

```text
src/
├── features/
│   ├── chat/
│   │   ├── components/
│   │   │   ├── MessageActionBar.vue          # 修改：新增效率动作入口
│   │   │   ├── SearchMessages.vue            # 修改：接 retrievalStore
│   │   │   └── ChatWindow.vue                # 修改：挂载 task/decision 面板
│   │   └── stores/chatStore.ts               # 修改：最小共享状态扩展
│   └── efficiency/                            # 新增：本里程碑统一域
│       ├── components/
│       │   ├── InboxPage.vue
│       │   ├── TaskPanel.vue
│       │   ├── DecisionHub.vue
│       │   └── DigestCenter.vue
│       ├── stores/
│       │   ├── inboxStore.ts
│       │   ├── taskStore.ts
│       │   ├── retrievalStore.ts
│       │   ├── digestStore.ts
│       │   └── decisionStore.ts
│       ├── services/
│       │   ├── inboxService.ts
│       │   ├── taskService.ts
│       │   ├── retrievalService.ts
│       │   ├── digestService.ts
│       │   └── decisionService.ts
│       ├── adapters/
│       │   ├── matrixEfficiencyAdapter.ts    # Matrix event -> domain event
│       │   ├── localIndexAdapter.ts          # Dexie 封装
│       │   └── notificationAdapter.ts        # 可选，系统通知
│       └── types/
│           └── efficiency.ts
├── matrix/
│   ├── events.ts                              # 修改：扩展 typed events
│   ├── messages.ts                            # 修改：decision/task payload helper
│   └── rooms.ts                               # 修改：account_data/state helper
└── app/router/index.ts                        # 修改：新增 inbox/decision/digest 路由
```

### Structure Rationale

- **`features/efficiency/`**：把跨聊天、跨页面的新能力收敛到一个域，避免把 `chatStore` 继续做成“万能桶”。
- **`services + adapters` 分层**：UI/Store 不直接依赖 Matrix SDK 或 Dexie，后续替换实现（例如从本地索引切到服务端索引）成本最低。

## Architectural Patterns

### Pattern 1: Matrix-First + Local Projection

**What:** Matrix（timeline/account_data/state）作为事实源；本地仅保存“可重建投影”（inbox 索引、digest 快照、检索倒排索引）。
**When to use:** inbox/retrieval/offline digest 都需要快读，但不能与 Matrix 真值漂移。
**Trade-offs:** 一致性更好；实现上需要重放/修复机制。

**Example:**
```ts
// matrix event -> local projection
matrixEvents.on('room.message', ({ roomId, event }) => {
  inboxService.projectMessage(roomId, event)   // 生成 triage item
  retrievalService.indexMessage(roomId, event) // 更新本地索引
})
```

### Pattern 2: Feature Store + Thin ChatStore

**What:** `chatStore` 只保留会话级状态；效率能力拆到独立 stores。
**When to use:** 新能力跨多个页面、生命周期独立于当前 room。
**Trade-offs:** store 数量增加；但职责边界清晰、测试更容易。

**Example:**
```ts
// MessageActionBar
function onConvertToTask(event: MatrixEvent, roomId: string) {
  taskStore.createFromMessage({ roomId, eventId: event.getId()!, body: event.getContent().body })
}
```

### Pattern 3: Incremental Event Subscription

**What:** 复用现有 `matrixEvents` 总线，只增量添加效率域事件与消费者。
**When to use:** brownfield 集成，不重写同步/房间逻辑。
**Trade-offs:** 需要严格事件命名和解绑策略，避免重复监听。

## Data Flow

### Request Flow

```text
[用户点击“稍后处理”]
    ↓
[MessageActionBar]
    ↓
[taskStore.deferMessage]
    ↓
[taskService.persistDeferred]
    ↓
[Matrix account_data(im.muon.tasks) + local index]
    ↓
[inboxStore.refreshDeferredBucket]
```

### State Management

```text
matrixEvents (/sync timeline/account_data)
    ↓
matrixEfficiencyAdapter
    ↓
inboxStore / taskStore / decisionStore / retrievalStore / digestStore
    ↓
InboxPage / TaskPanel / DecisionHub / DigestCenter
```

### Key Data Flows

1. **Unified inbox flow:** `room.message + receipt + mention + defer` → `inboxService` 归一化为 `InboxItem`（mention/unreplied/deferred）。
2. **Message-to-task flow:** 消息上下文（roomId/eventId/sender/ts/snippet）→ `taskStore` 创建任务 → 状态变更回写 `account_data`，点击任务可 `router + eventId` 跳回。
3. **Retrieval flow:** 在线优先 `searchRoomEvents`，离线回退 Dexie 索引；结果统一进入 `retrievalStore`。
4. **Offline digest flow:** 应用启动读取 `lastSeenAt`，增量聚合期间消息并生成 digest card，用户确认后推进 checkpoint。
5. **Decision capture flow:** 从消息生成 `DecisionCard`（结论/依据/相关消息），写入 `im.muon.decision.*`（建议 room-scoped account_data 或事件）并索引。

## New vs Modified Integration Map

| Area | New | Modified | Integration Point |
|------|-----|----------|-------------------|
| Router | `inbox/decision/digest` 路由 | `app/router/index.ts` | 保持 `AppLayout` 容器不变，仅扩子路由 |
| Chat actions | `TaskPanel` / `DecisionHub` | `MessageActionBar.vue`, `ChatWindow.vue` | 从消息动作发起 triage/task/decision |
| State | `inbox/task/retrieval/digest/decision` stores | `chatStore.ts`（仅加 bridge 状态） | 避免把效率状态塞进 chatStore |
| Matrix integration | `matrixEfficiencyAdapter.ts` | `matrix/events.ts`, `rooms.ts`, `messages.ts` | 复用现有 mitt 事件总线 |
| Persistence | `localIndexAdapter.ts` (Dexie) | 无或少量 app bootstrap | 离线检索与 digest 依赖本地索引 |
| Notifications | `notificationAdapter.ts`（可选） | `src-tauri/src/lib.rs`（若启用插件） | 目前 Rust 未初始化 notification 插件 |

## Implementation Sequencing (Recommended Build Order)

1. **Phase A — Domain contracts & adapters（先打地基）**
   - 新增 `features/efficiency/types`、`matrixEfficiencyAdapter`、空 stores。
   - 修改 `matrix/events.ts` 增加效率域事件。
   - 验证：不改 UI，日志中可看到事件流。

2. **Phase B — Unified inbox MVP（最低风险可见价值）**
   - 实现 `inboxStore + inboxService + InboxPage`。
   - 先支持 mentions/unread/replied 状态，不做 defer。
   - 路由接入 `/inbox`，不影响现有 chat path。

3. **Phase C — Message defer + personal queue**
   - `taskStore.deferMessage` + `account_data` 持久化。
   - 修改 `MessageActionBar` 增加 defer。
   - Inbox 增加 deferred bucket。

4. **Phase D — Message-to-task + jump-back**
   - task 实体化（todo/doing/done）、source anchor（roomId/eventId）。
   - 加 `TaskPanel`，支持点击回跳消息。

5. **Phase E — Retrieval integration（在线优先，离线回退）**
   - 先接 `searchRoomEvents` 到 `retrievalStore`。
   - 再加 Dexie 本地索引回退与排序融合。

6. **Phase F — Offline digest**
   - 引入 `digestStore` + checkpoint（`lastSeenAt`）。
   - 初期仅 in-app digest；系统通知延后到插件启用后。

7. **Phase G — Decision capture**
   - `decisionStore/service` 与 UI（DecisionHub）。
   - 复用 retrieval 索引与 source anchor，最后接跨会话检索。

> 依赖关系：A → B → C → D；A/B → E；E → F/G（因为 digest 与 decision 都需要检索/索引能力）。

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | 纯客户端投影 + Matrix server-side search 足够 |
| 1k-100k users | 对本地索引做分片（按 room/time），增加冷数据淘汰策略 |
| 100k+ users | 考虑服务端检索/摘要服务，客户端仅保留最近窗口缓存 |

### Scaling Priorities

1. **First bottleneck:** 本地检索索引体积与重建时间 → 增量索引 + 版本化迁移 + LRU 清理。
2. **Second bottleneck:** 多 store 对同一事件重复计算 → 在 `matrixEfficiencyAdapter` 做一次归一化后广播。

## Anti-Patterns

### Anti-Pattern 1: 把所有新状态继续塞进 `chatStore`

**What people do:** inbox/task/digest 全挂在 `chatStore`。
**Why it's wrong:** 会导致房间切换、副作用、持久化策略耦合，后续维护困难。
**Do this instead:** 保持 `chatStore` 会话职责；效率能力独立 store。

### Anti-Pattern 2: 直接在组件里调用 Matrix SDK + 本地 DB

**What people do:** 组件内同时 `getClient().searchRoomEvents()` + Dexie 写入。
**Why it's wrong:** 难测、重复逻辑、错误恢复不一致。
**Do this instead:** 组件只 dispatch，service/adapters 处理外部 I/O。

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Matrix Client-Server API | `matrix-js-sdk` (`searchRoomEvents`, `setAccountData`, `/sync`) | 作为真值源；`room_events` 不含 E2EE 房间明文检索 |
| Tauri Notification Plugin (optional) | `@tauri-apps/plugin-notification` + Rust plugin init | 当前 `src-tauri/src/lib.rs` 未初始化 notification 插件，需显式接入 |
| Local IndexedDB (Dexie) | `localIndexAdapter` | 当前依赖已存在但未落地使用，适合离线检索与 digest 快照 |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `matrix/events.ts` ↔ `efficiency/adapters` | typed event bus | 统一入口做归一化，避免每个 store 重复解析 MatrixEvent |
| `chat/components` ↔ `efficiency/stores` | Pinia action API | 消息动作只发命令，不做持久化 |
| `efficiency/services` ↔ `matrix/*` | service calls | 统一错误重试/回滚策略 |
| `efficiency/services` ↔ `localIndexAdapter` | repository interface | 保持离线存储可替换（Dexie/tauri-sql） |

## Sources

- Repo code (HIGH):
  - `src/features/chat/stores/chatStore.ts`
  - `src/features/chat/components/MessageActionBar.vue`
  - `src/features/chat/composables/useMessages.ts`
  - `src/features/chat/composables/useConversations.ts`
  - `src/features/server/stores/serverStore.ts`
  - `src/matrix/events.ts`, `src/matrix/rooms.ts`, `src/matrix/messages.ts`
  - `src/app/router/index.ts`, `src/shared/components/AppLayout.vue`
  - `src-tauri/src/lib.rs`, `package.json`
- Matrix Spec (HIGH):
  - Client Config account data endpoint: https://spec.matrix.org/latest/client-server-api/#put_matrixclientv3useruseridaccount_datatype
  - Server-side search (`room_events` behavior): https://spec.matrix.org/latest/client-server-api/#server-side-search
  - Direct messaging `m.direct` semantics: https://spec.matrix.org/latest/client-server-api/#direct-messaging
- matrix-js-sdk API (HIGH):
  - `searchRoomEvents`, `setAccountData`, `setRoomAccountData`: https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html
- Tauri notification plugin docs (MEDIUM):
  - https://v2.tauri.app/plugin/notification/
  - https://v2.tauri.app/reference/javascript/notification/

---
*Architecture research for: Muon milestone “chat-efficiency features”*
*Researched: 2026-03-05*
