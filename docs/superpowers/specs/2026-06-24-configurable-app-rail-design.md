# 可配置鸭栏（Configurable App Rail）设计

日期：2026-06-24
状态：✅ 已实现（分支 `feat/app-rail-pinned`，commit `aca40c2`）

## 背景

左侧鸭栏 `WorkspaceAppRail.vue` 原本写死渲染全部 20 个 `primaryWorkspaceApps`，64px 竖排靠 `overflow-y-auto` 硬塞，常规屏高必然溢出——"过于拥挤"。其中相当一部分（审批/邮件/通话等）仍是 mock 占位。

## 目标

让用户自己决定哪些应用固定在鸭栏。鸭栏只渲染用户固定（pinned）的应用；底部「全部应用」Popover 网格作为兜底入口，在其中 pin/unpin，被取消固定的应用随时找回。

## 非目标（精简版边界，已与用户确认）

- ❌ 拖拽排序（顺序固定 = `navigation.ts` 原顺序）
- ❌ 分类分组
- ❌ 设置页镜像管理
- ❌ 任何后端/云同步 —— **纯本地 localStorage**，零 API 改动

## 架构

纯前端。pinned id 列表存进既有本地偏好 store（`@shared/stores/settingsStore`，`@tanstack/vue-store` + localStorage），与 theme/notificationChannels 同一套持久化。`navigation.ts` 提供纯函数 `resolvePinnedApps` 解析 id→app。组件用 `useStore` 响应式读取。

解耦原则：`settingsStore`（shared 底层）不反向依赖 `navigation`（app 层）。默认集放 store 自身；id↔app 解析放 navigation 纯函数。

```
settingsStore (shared, 纯本地)          navigation.ts (app)
  pinnedApps: string[]  ──读──►  resolvePinnedApps(ids): WorkspaceApp[]
  togglePinnedApp(id)                  (按原顺序过滤 + 剔非法 + 排除 settings)
        │                                        │
        └────────── useStore ─► WorkspaceAppRail.vue ─► AllAppsPopover.vue
```

## 详细设计（对应实现）

### `navigation.ts`
```ts
export function resolvePinnedApps(ids: readonly string[]): WorkspaceApp[] {
  const set = new Set(ids)
  return primaryWorkspaceApps.filter((app) => set.has(app.id))
}
```
按 `primaryWorkspaceApps`（已排除 settings）原顺序过滤 → 自动得到"固定顺序、剔除非法 id、settings 永不入选"三个性质。

### `settingsStore.ts`
套用既有 `notificationChannels`（JSON 序列化）模式：
- `SettingsState.pinnedApps: string[]`
- `DEFAULT_PINNED_APPS = ['messages', 'calendar', 'docs', 'tasks', 'contacts', 'workplace']`
- `STORAGE_KEYS.pinnedApps = 'muon_pinned_apps'`
- `readStringArray(key, fallback)`：JSON.parse，非数组/非全字符串/失败回退默认
- `togglePinnedApp(id)`：`includes ? filter : [...spread]`

### `AllAppsPopover.vue`（新建）
- 4 列网格遍历 `primaryWorkspaceApps`(20)；`useStore` 响应式读 pin 状态
- 点格子 `emit('open', app)`；右上角图钉按钮（与格子按钮平级，不嵌套）`@click.stop="togglePinnedApp"`
- 图钉 `aria-label` 随状态在 `sidebar.unpinApp`/`sidebar.pinApp` 切换
- testid：`all-apps-panel`、`all-apps-open-<id>`、`all-apps-pin-<id>`

### `WorkspaceAppRail.vue`
- `pinnedApps = computed(() => resolvePinnedApps(useStore(settingsStore, s => s.pinnedApps).value))`
- 主区 `v-for="app in pinnedApps"`（原为 `primaryWorkspaceApps`）
- 底部「搜索」上方插入 `<Popover v-model:open>` + `LayoutGrid` 触发（`workspace-all-apps`）+ `<PopoverContent side="right" align="end">` 内嵌 `AllAppsPopover`
- 空状态：`pinnedApps` 为空时主区显示 `workspace-rail-empty`（LayoutGrid + `sidebar.emptyPinnedHint`），引导去「全部应用」
- `onOpenApp` = 关闭 popover + `openApp`（保留 messages 的 `lastMessagesPath` 特殊跳转）；footer settings 不变

### i18n（`locales/{zh,en}.json` 的 `sidebar` 段）
| key | zh | en |
|---|---|---|
| `allApps` | 全部应用 | All apps |
| `pinApp` | 固定到鸭栏 | Pin to rail |
| `unpinApp` | 取消固定 | Unpin |
| `emptyPinnedHint` | 去全部应用固定 | Pin from All apps |

## 默认固定集

无 localStorage 值时固定：**消息、日历、文档、任务、联系人、工作台**（飞书核心 + 有真实本地数据的 calendar/tasks）。其余 14 个收进「全部应用」面板。

## 边界与已知限制

- **空固定集**：全 unpin 后主区显示 `workspace-rail-empty` 提示，「全部应用」入口恒在可恢复。
- **非法/已删 id**：`resolvePinnedApps` 渲染时过滤，不可见不报错；`togglePinnedApp` 不校验 id 合法性，脏 id 静默留存 localStorage（当前调用方只传合法 id，无实际风险）。**刻意不在 store 层清理**——那需要 `settingsStore` 反向依赖 `navigation` 的合法集合，破坏 shared 不依赖 app 的解耦原则。YAGNI。
- **未读角标**：仅在 messages 被固定时渲染（messages 在默认集内）。unpin messages 则未读数不可见——可接受取舍。
- **顺序**：永远按 navigation 原序，toggle 先后不影响显示顺序。

## 测试（真实通过）

- `tests/components/workspaceNavigation.test.ts`（3）：resolvePinnedApps 顺序/过滤/空输入
- `tests/stores/pinnedApps.test.ts`（4）：默认水合 / pin / unpin / 持久化
- `tests/components/AllAppsPopover.test.ts`（5）：网格渲染排除 settings / emit open / pin 不 emit / unpin / aria-label
- `tests/components/WorkspaceAppRail.test.ts`（10）：只渲染固定项 / 非固定项不存在 / launcher 按钮 / 空状态 / 导航 / 未读角标 / 全局搜索

验证：上述 22 测试全过；全量 desktop 单测 1480 通过（267 文件）；`type-check` exit 0。
