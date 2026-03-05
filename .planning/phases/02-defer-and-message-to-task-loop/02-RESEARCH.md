# Phase 2: Defer and Message-to-Task Loop - Research

**Researched:** 2026-03-05
**Domain:** Vue 3 + Pinia 的 defer 队列与消息转任务闭环
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

## Summary

Phase 2 建议完全沿用 Phase 1 已落地的交互骨架：**事件驱动派生列表 + Pinia setup store + 侧栏就地处理 + 路由 query 定位回跳**。当前代码已经有三个关键复用点：`UnifiedInboxPanel`（收件箱入口）、`MessageActionBar`（消息 More 菜单入口）、`loadInboxEventContext + focusEventId`（稳定回跳链路）。因此本阶段不应引入新页面流或外部任务系统，而是在 chat feature 内增量扩展 defer/task 两条轻量状态流。

在数据层，项目现状明确偏向本地持久化（`localStorage` + 版本化 key），Phase 1 也是该策略。对本阶段目标（提醒、状态流转、回链）而言，本地模型足够支撑验收，且能避免过早引入同步复杂度。建议把 defer/task 都建成独立 store（含 versioned schema 与迁移入口），UI 通过 composable 或 computed 派生显示列表，保证规则集中可测。

**Primary recommendation:** 新增 `deferStore + taskStore`（统一事件引用模型：`roomId + eventId`），并复用既有 `loadInboxEventContext + router.query.focusEventId` 实现任务详情回跳源消息。

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INBX-04 | User can defer an inbox item with a reminder time and view it in a personal defer queue. | 在 `UnifiedInboxPanel` 增加 defer 动作；新增 `deferStore` 持久化提醒时间；新增 defer 队列视图按 dueAt 升序展示。 |
| INBX-05 | User can mark deferred items as completed or archived from the defer queue. | 在 defer 队列提供 `todo -> completed/archived` 状态动作；主队列只展示 active，历史视图承载 completed/archived。 |
| TASK-01 | User can create a task from any message with assignee, due date, and status fields. | 在 `MessageActionBar` 的 More 菜单新增“转任务”；任务实体强制包含 assignee/dueAt/status/sourceRef。 |
| TASK-02 | User can open a created task and navigate back to the exact source message. | 任务详情保存 `source: { roomId, eventId }`，回跳时复用 `loadInboxEventContext` 预加载 + `focusEventId` 路由定位。 |
| TASK-03 | User can move tasks across todo, doing, and done states in a task panel. | 在 `ChatWindow` 侧栏体系新增 task panel；状态流转收敛到 store action（受限状态机）。 |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vue | ^3.5.29 | 组件与响应式 UI | 当前所有 chat 面板均为 `<script setup>` SFC，直接复用 |
| pinia | ^3.0.4 | defer/task 状态容器 | 项目 store 均采用 setup store + action 模式，便于统一状态流转 |
| vue-router | ^5.0.3 | 任务回跳消息定位 | `MessageList.vue` 已支持 `focusEventId` query 定位 |
| matrix-js-sdk | ^41.0.0 | 消息源定位与上下文预加载 | 现有 `loadInboxEventContext()` 已验证可用 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | ^4.1.0 | defer 预设时间计算与展示 | 处理“1小时后/明早/明天”等快捷时间点 |
| vue-i18n | ^11.2.8 | defer/task 文案本地化 | 新增按钮、状态、提醒文案时同步中英 key |
| vitest + @vue/test-utils | ^4.0.18 / ^2.4.6 | 阶段行为验证 | store 状态机 + 组件交互回归测试 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 本地 Pinia + localStorage | 远端任务服务 / Matrix account_data 同步 | 同步能力更强，但显著增加 Phase 2 复杂度与失败面 |
| 侧栏内任务面板 | 独立任务路由页面 | 页面清晰但破坏“在消息上下文内处理”的阶段目标 |

**Installation:**
```bash
pnpm install
```

## Architecture Patterns

### Recommended Project Structure
```text
src/
├── features/chat/
│   ├── stores/
│   │   ├── deferStore.ts         # defer 队列 + 状态流转 + 持久化
│   │   └── taskStore.ts          # 任务实体 + todo/doing/done 状态机
│   ├── types/
│   │   ├── defer.ts              # DeferItem / DeferStatus
│   │   └── task.ts               # TaskItem / TaskStatus / SourceRef
│   └── components/
│       ├── DeferQueuePanel.vue   # 主队列 + 历史视图
│       ├── TaskPanel.vue         # todo/doing/done 三列或三组
│       └── TaskComposerDialog.vue# 从消息创建任务
└── matrix/
    └── inbox.ts                  # 复用 loadInboxEventContext（不新增平行跳转实现）
```

### Pattern 1: 模块级源数据 + computed 派生列表
**What:** store 存单一事实源（items map/list），UI 只消费 computed（active/history/overdue）。
**When to use:** defer 主队列与历史视图分离、task 三状态分组。
**Example:**
```typescript
// Source: src/features/chat/composables/useUnifiedInbox.ts
const items = computed(() => {
  let list = allItems.value.filter(item => !store.isProcessed(item.id))
  if (store.filter !== 'all')
    list = list.filter(item => item.type === store.filter)
  return list
})
```

### Pattern 2: Set/Map + action 封装状态变更
**What:** 使用 setup store 中 action 统一更新状态，不在组件直接改容器。
**When to use:** task 状态流转、defer 完成/归档、批量操作。
**Example:**
```typescript
// Source: src/features/chat/stores/chatStore.ts
const selectedMessages = reactive(new Set<string>())
function toggleMessageSelection(eventId: string) {
  if (selectedMessages.has(eventId)) selectedMessages.delete(eventId)
  else selectedMessages.add(eventId)
}
```

### Pattern 3: 回跳链路“预加载上下文 + query 定位”
**What:** 跳转前先预加载上下文，随后通过 `focusEventId` 驱动消息列表精确定位。
**When to use:** TASK-02 从任务详情跳回源消息。
**Example:**
```typescript
// Source: src/features/server/components/ChannelSidebar.vue
await loadInboxEventContext(payload.roomId, payload.eventId)
await router.push({
  path: `/dm/${encodeURIComponent(payload.roomId)}`,
  query: { focusEventId: payload.eventId },
})
```

### Anti-Patterns to Avoid
- **在多个组件各自维护 task/defer 副本状态：** 会造成状态漂移，必须单一 store 源。
- **将 task status 作为自由字符串：** 会导致 `todo/doing/done` 之外脏值，必须使用联合类型与转移函数。
- **回跳只做 `router.push` 不预加载 context：** 目标消息可能未在本地 timeline，定位失败率高。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 消息回链定位 | 新写一套 timeline 拉取/滚动逻辑 | `loadInboxEventContext` + `focusEventId` 现有链路 | 现有链路已覆盖 fallback 与分页场景 |
| 状态流转校验 | 组件内 if/else 到处散落 | store 内集中状态机 action | 规则可测、可追踪、避免分叉逻辑 |
| 本地持久化格式 | 无版本号的临时 JSON | versioned key（如 `muon:task:v1`）+ hydrate 函数 | 未来 schema 变更可迁移，避免线上脏数据 |
| 时间预设逻辑 | 手写大量日期拼接字符串 | `Date` + `date-fns` 统一计算函数 | 降低“今晚/明早”边界错误 |

**Key insight:** 本阶段难点是“状态一致性 + 源消息可追踪性”，不是 UI 绘制；应优先复用 Phase 1 已验证链路。

## Common Pitfalls

### Pitfall 1: “今晚/明早/明天”边界不一致
**What goes wrong:** 不同入口计算出不同提醒时间，排序混乱。  
**Why it happens:** 预设计算散落在组件，且未统一本地时区规则。  
**How to avoid:** 单一 `buildDeferPresetDate(now)` 工具函数；所有入口共用。  
**Warning signs:** 同一条目在不同入口 defer 后 dueAt 不同。

### Pitfall 2: defer 主队列混入完成/归档项
**What goes wrong:** 主队列噪声上升，待处理项被淹没。  
**Why it happens:** 仅通过 UI 隐藏，未在派生列表层强约束状态。  
**How to avoid:** `activeDeferItems = items.filter(status === 'deferred')`，历史视图独立派生。  
**Warning signs:** 完成项在主列表仍可见或可继续提醒。

### Pitfall 3: 任务与源消息引用断链
**What goes wrong:** 点击“回到消息”后落到底部或错误房间。  
**Why it happens:** 未完整保存 `roomId + eventId`，或路由参数未 encode。  
**How to avoid:** task schema 中强制 `sourceRef`；回跳统一走公共 helper。  
**Warning signs:** `focusEventId` 存在但 `scrollToPosition` 长期失败。

### Pitfall 4: 快速重复点击导致重复建任务
**What goes wrong:** 同一消息生成多条近似任务。  
**Why it happens:** 创建动作无幂等防护与 UI loading 锁。  
**How to avoid:** 组件提交按钮加 pending 锁；store 创建时做去重策略（可按 source+title 窗口期）。  
**Warning signs:** 单消息在短时间内出现多条完全同字段任务。

## Code Examples

Verified patterns from official/project sources:

### 现有回跳定位消费 `focusEventId`
```typescript
// Source: src/features/chat/components/MessageList.vue
watch(
  () => route.query.focusEventId,
  async (value) => {
    pendingFocusEventId.value = typeof value === 'string' ? value : null
    if (pendingFocusEventId.value)
      await tryFocusEventFromQuery()
  },
  { immediate: true },
)
```

### setup store 官方模式（Pinia）
```typescript
// Source: https://pinia.vuejs.org/core-concepts/
export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  function increment() { count.value++ }
  return { count, increment }
})
```

### Vitest CLI 文件级快速回归
```bash
# Source: https://vitest.dev/guide/cli
vitest run tests/unit/stores/taskStore.test.ts
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 收件箱只做 triage（processed） | 收件箱补充 defer 队列（提醒 + 完成/归档） | Phase 2 需求定义（2026-03-05） | 从“只清理”升级为“可延后执行” |
| 消息处理与任务系统分离 | 消息原地转任务并保留 sourceRef | Phase 2 需求定义（2026-03-05） | 任务执行可无损回到对话语境 |
| 仅会话/消息侧栏 | 侧栏扩展 task panel 状态流转 | 现有 `activeSidePanel` 模式可扩展 | 降低跨页面切换成本 |

**Deprecated/outdated:**
- 在组件内零散维护临时 task/defer state：会与 Pinia 单一状态源冲突，应避免。

## Open Questions

1. **任务 `assignee` 的最小模型是否仅支持当前用户？**
   - What we know: 需求要求有 assignee 字段。
   - What's unclear: 是否必须支持房间成员选择器，或先支持“我自己”即可。
   - Recommendation: Phase 2 先支持 `self + 文本输入`，成员检索增强留后续阶段。

2. **defer 历史视图是 tab 还是折叠区？**
   - What we know: 属于 Claude discretion。
   - What's unclear: 哪种形式更贴合现有侧栏密度。
   - Recommendation: 优先同面板内双 tab（Active/History），最小改动且可测。

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 + Vue Test Utils ^2.4.6 |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm test:unit -- tests/unit/stores/taskStore.test.ts` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INBX-04 | 为 inbox 项设置提醒并进入 defer 队列 | unit + component | `pnpm test:unit -- tests/unit/stores/deferStore.test.ts -t "create deferred item"` | ❌ Wave 0 |
| INBX-05 | 在 defer 队列完成/归档并进入历史视图 | unit + component | `pnpm test:unit -- tests/components/DeferQueuePanel.test.ts -t "move completed archived to history"` | ❌ Wave 0 |
| TASK-01 | 从任意消息创建含 assignee/due/status 的任务 | component | `pnpm test:unit -- tests/components/MessageActionBar.test.ts -t "create task from message"` | ❌ Wave 0 |
| TASK-02 | 从任务详情准确回跳源消息 | integration | `pnpm test:unit -- tests/components/TaskPanel.test.ts -t "jump to source message"` | ❌ Wave 0 |
| TASK-03 | 在 task panel 中 todo/doing/done 流转 | unit + component | `pnpm test:unit -- tests/unit/stores/taskStore.test.ts -t "transition task status"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test:unit -- tests/unit/stores/taskStore.test.ts tests/unit/stores/deferStore.test.ts`
- **Per wave merge:** `pnpm test:unit`
- **Phase gate:** `pnpm test` 全绿后进入 `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/stores/deferStore.test.ts` — covers INBX-04/INBX-05
- [ ] `tests/unit/stores/taskStore.test.ts` — covers TASK-03
- [ ] `tests/components/MessageActionBar.test.ts` — covers TASK-01 action entry
- [ ] `tests/components/TaskPanel.test.ts` — covers TASK-02/TASK-03 UI flow
- [ ] `tests/components/DeferQueuePanel.test.ts` — covers INBX-04/INBX-05 UI flow

## Sources

### Primary (HIGH confidence)
- Project source: `package.json`, `vitest.config.ts`, `.planning/phases/02-defer-and-message-to-task-loop/02-CONTEXT.md`
- Project source: `src/features/chat/components/UnifiedInboxPanel.vue`, `src/features/chat/components/MessageActionBar.vue`, `src/features/chat/components/ChatWindow.vue`, `src/features/server/components/ChannelSidebar.vue`
- Project source: `src/features/chat/stores/inboxStore.ts`, `src/features/chat/stores/chatStore.ts`, `src/features/chat/composables/useUnifiedInbox.ts`, `src/matrix/inbox.ts`, `src/features/chat/components/MessageList.vue`
- Pinia docs: https://pinia.vuejs.org/core-concepts/
- Vue `<script setup>` API: https://vuejs.org/api/sfc-script-setup.html
- Matrix Client-Server spec (Event Context): https://spec.matrix.org/latest/client-server-api/#get_matrixclientv3roomsroomidcontexteventid

### Secondary (MEDIUM confidence)
- Vitest CLI guide: https://vitest.dev/guide/cli
- matrix-js-sdk API reference (`getEventTimeline`): https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#getEventTimeline

### Tertiary (LOW confidence)
- 无（本次关键结论主要来自项目代码与官方文档）

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - 直接来自 `package.json` 与既有实现
- Architecture: **HIGH** - 与 Phase 1 已落地模式一致，且代码已有集成点
- Pitfalls: **MEDIUM** - 部分为实现经验推断，需在 Wave 0 测试中验证

**Research date:** 2026-03-05
**Valid until:** 2026-04-04
