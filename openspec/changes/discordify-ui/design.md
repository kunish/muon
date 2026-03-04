## Context

Muon 是一个基于 Matrix 协议的桌面 IM 客户端（Tauri 2 + Vue 3 + TypeScript），当前采用飞书风格的三栏布局（60px 导航栏 + 会话列表 + 聊天窗口）。Matrix 协议原生支持 Spaces（MSC1772）层级结构，但 Muon 目前完全没有实现 Spaces 支持，所有房间以平铺列表展示。

当前技术栈：Vue 3 Composition API + Pinia 3 + Tailwind CSS 4 + Radix Vue + TipTap + LiveKit（VoIP） + matrix-js-sdk。UI 组件系统为 shadcn/ui Vue 版（原子组件在 `src/shared/components/ui/` 目录）。

本设计将 Muon 从飞书风格全面重构为 Discord 风格，涉及布局、主题、导航、消息渲染、成员管理和语音频道六大领域的变更。

## Goals / Non-Goals

**Goals:**
- 实现 Discord 四栏布局：服务器栏(72px) → 频道侧栏(240px) → 聊天主区(flex) → 成员面板(240px, 可折叠)
- 基于 Matrix Spaces API 实现服务器/频道层级结构
- 暗色优先的 Discord 颜色体系
- Discord 风格紧凑消息列表（非气泡样式）
- 语音频道 UI 与语音连接状态栏（复用 LiveKit）
- 服务器设置与角色权限管理（基于 Matrix power levels）

**Non-Goals:**
- 不实现 Discord Nitro 等付费功能
- 不实现 Discord Bot 框架（保持 Matrix 原生 bot 支持）
- 不实现 Discord 的「发现服务器」公共目录（可后续迭代）
- 不修改 Tauri 后端 Rust 代码
- 不实现自定义表情服务器（保持现有贴纸系统）
- 不实现 Discord 的 Stage Channel

## Decisions

### D1: 布局架构 — 嵌套 RouterView 模式

**选择**: 在 `AppLayout.vue` 中采用嵌套 RouterView，外层为服务器栏 + 内容区，内容区根据路由渲染频道侧栏和聊天区。

**路由结构**:
```
/server/:serverId/channel/:channelId  → 服务器内频道
/dm/:roomId                            → DM 对话
/dm                                    → DM 列表（频道侧栏位置）
/settings/*                            → 用户设置
```

**替代方案**: 完全抛弃 Vue Router 改用状态驱动导航 — 拒绝，因为 URL 可分享、浏览器后退按钮有价值。

**理由**: Discord Web 版也采用 URL 路由模式，与现有 Vue Router 基础设施兼容。

### D2: Matrix Spaces → Discord 服务器映射

**选择**: 一级 Space 映射为「服务器」，子 Space 映射为频道「分类」(Category)，Space 内的房间映射为「频道」。

**映射规则**:
| Matrix 概念 | Discord 概念 | 判定条件 |
|---|---|---|
| Top-level Space | 服务器 | `room.isSpaceRoom() && 无父 Space` |
| 子 Space | 频道分类 | `room.isSpaceRoom() && 有父 Space` |
| Space 内房间 | 文字频道 | `!isVoiceChannel(room)` |
| Space 内标记房间 | 语音频道 | 房间 state 含 `m.room.voice` 或自定义 `im.muon.voice_channel` |
| DM 房间 | DM | `room.isDirect()` |
| 独立非 Space 房间 | 归入「未分类」服务器 | 不属于任何 Space |

**替代方案**: 创建虚拟 Space 作为容器 — 拒绝，会产生用户不可见的 Matrix 实体，增加复杂度。

**理由**: 直接利用 Matrix Spaces 的层级结构，语义清晰，与其他 Matrix 客户端互操作。

### D3: 新增 `src/matrix/spaces.ts` 模块

**选择**: 新增独立模块封装所有 Spaces API 调用：
- `getSpaceHierarchy(spaceId)` — 获取 Space 层级
- `createSpace(name, opts)` — 创建服务器/分类
- `addRoomToSpace(spaceId, roomId, opts)` — 添加频道
- `removeRoomFromSpace(spaceId, roomId)` — 移除频道
- `getSpaceMembers(spaceId)` — 获取成员列表
- `setSpacePowerLevels(spaceId, levels)` — 设置权限

**理由**: 与现有 `rooms.ts`、`messages.ts` 保持一致的模块化分层。

### D4: 颜色体系 — CSS 变量覆盖

**选择**: 保持现有 CSS 变量机制（`--color-*`），重新定义暗色模式的值为 Discord 风格配色：

```css
:root {
  /* Discord Blurple 作为 primary */
  --color-primary: hsl(235 86% 65%);         /* #5865F2 */
  --color-primary-foreground: hsl(0 0% 100%);
}
.dark {
  --color-background: hsl(220 8% 25%);       /* #36393f - 主背景 */
  --color-foreground: hsl(210 10% 87%);       /* #dcddde - 主文字 */
  --color-muted: hsl(220 7% 20%);             /* #2f3136 - 侧边栏 */
  --color-card: hsl(220 8% 22%);              /* #32353b - 卡片 */
  --color-sidebar: hsl(220 8% 14%);           /* #202225 - 服务器栏 */
  --color-border: hsl(220 4% 15%);            /* #26282c */
  --color-accent: hsl(220 8% 30%);            /* hover 高亮 */
}
```

**替代方案**: 完全独立的 Discord 主题文件 — 拒绝，Tailwind CSS 4 的 `@theme` 机制天然支持变量覆盖。

**理由**: 零新依赖，最小改动即可全局切换色调。

### D5: 消息渲染 — 新组件替代气泡

**选择**: 创建新的 `DiscordMessage.vue` 和 `DiscordMessageGroup.vue` 组件，替代现有 `MessageBubble.vue` 的气泡样式。

**消息布局结构**:
```
[48px 头像] [用户名 timestamp]
           [消息内容]
           [消息内容（连续消息，无头像）]
           [悬浮操作栏: 😀 ↩️ ⋯]
```

**分组规则**: 同一用户、5 分钟内的连续消息归为一组，仅首条显示头像和用户名。

**替代方案**: 修改 `MessageBubble.vue` 添加 Discord 模式 — 拒绝，两种风格差异太大，强塞在一个组件里会导致过度复杂的条件分支。

### D6: 状态管理 — 新增 serverStore

**选择**: 新增 `useServerStore` (Pinia)，管理服务器/频道导航状态：

```typescript
// src/features/server/stores/serverStore.ts
{
  servers: Map<string, ServerInfo>,      // spaceId -> 服务器信息
  currentServerId: string | null,
  serverOrder: string[],                 // 排序后的服务器 ID
  channelTree: Map<string, ChannelCategory[]>, // serverId -> 频道树
  collapsedCategories: Set<string>,      // 折叠的分类
  voiceConnections: Map<string, VoiceConnection>, // 语音频道连接状态
}
```

现有 `chatStore` 保留，负责消息级状态（replyingTo, editingEvent 等）。

### D7: 语音频道 — LiveKit 房间映射

**选择**: 语音频道通过房间 state event `im.muon.voice_channel: { enabled: true }` 标识。连接语音频道时，复用现有 `useCall` composable 连接到对应的 LiveKit 房间。

**语音状态栏**: 固定在频道侧栏底部，显示当前连接的语音频道名、自己的麦克风/耳机状态、断开按钮。

**替代方案**: 使用 matrix-js-sdk 内置 VoIP — 拒绝，已禁用（`disableVoip: true`），LiveKit 更适合多人语音。

## Risks / Trade-offs

**[R1: 大规模重构风险]** → 分阶段实施。先实现布局框架和路由，再逐步迁移各功能区。每个阶段可独立部署验证。

**[R2: Matrix Spaces 兼容性]** → Spaces API (MSC1772) 在 Synapse 和 Conduit 中已稳定。通过 `getSpaceHierarchy` API 获取层级，降级情况下（旧服务器不支持）将独立房间展示在「未分类」分组中。

**[R3: 现有功能回归]** → 所有现有功能（加密、已读回执、Thread、Reactions、贴纸、GIF、位置分享等）保持不变，仅改变渲染层。消息数据层（`src/matrix/messages.ts`）不做修改。

**[R4: 性能影响 — Space 层级查询]** → Space hierarchy 请求可能较慢。缓存策略：首次加载缓存到 `serverStore`，后续通过 sync 事件增量更新。

**[R5: DM 与服务器的导航冲突]** → DM 独立于服务器概念，在服务器列表中作为特殊图标入口（类似 Discord Home 按钮），切换后频道侧栏变为 DM 列表。

**[R6: 飞书特有功能丢失]** → 快捷联系人入口、Tab 栏（聊天/文件/文档）、筛选标签等飞书风格功能将被移除或重新设计。文件/文档功能移至频道内的独立 Tab 或命令。
