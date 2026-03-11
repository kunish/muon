## Why

Muon 当前采用飞书风格的 IM 布局（平铺会话列表 + 聊天窗口），缺少 Discord 风格的服务器/频道层级组织能力。Matrix 协议原生支持 Spaces（类似 Discord 服务器）和层级房间结构，但 Muon 完全没有实现 Spaces 支持。全面 Discord 化将引入服务器-频道-成员的组织范式，支持语音频道、角色权限、丰富的成员状态展示，使 Muon 在群组协作场景中具备更强的社区管理能力。

## What Changes

### 布局重构

- **BREAKING**: 将当前的「Sidebar(60px) + ConversationList + ChatWindow」三栏布局重构为 Discord 四栏布局：「服务器列表(72px) + 频道侧栏(240px) + 聊天主区(flex) + 成员列表(240px, 可折叠)」
- 移除现有的 `Sidebar.vue`（60px 导航栏），用垂直服务器图标列表替代
- 移除 `ConversationList.vue` 的平铺会话模式，改为频道分类树形结构

### 服务器与频道（基于 Matrix Spaces）

- 实现 Matrix Spaces 支持，映射为 Discord「服务器」概念
- 服务器列表：圆角方形图标、悬停变圆角、拖拽排序、未读指示器
- 频道分类（Category）：可折叠的频道分组，映射为子 Space
- 文字频道：带 `#` 前缀，对应普通房间
- 语音频道：带 🔊 图标，显示当前连接用户列表
- DM 作为特殊入口放在服务器列表底部

### 暗色主题优先

- **BREAKING**: 将默认主题改为暗色
- 重新设计颜色体系：从中性灰调改为 Discord 风格的深色紫灰色调（`#36393f` 主背景、`#2f3136` 侧边栏、`#202225` 服务器栏）
- 引入 Discord 品牌色 `#5865F2`（Blurple）作为主色调

### 成员列表面板

- 右侧常驻成员列表面板（可折叠），按角色分组显示
- 在线状态指示器（在线/空闲/勿扰/离线）实时展示
- 成员右键菜单（私信、禁言、踢出、封禁等操作）
- 用户信息悬浮卡片（头像、状态、角色、加入时间）

### 语音频道 UI

- 频道列表中的语音频道显示当前连接用户头像
- 语音连接状态栏固定在频道侧栏底部（用户头像 + 语音状态 + 连接/断开控制）
- 复用现有 LiveKit 通话基础设施

### 消息区域风格

- 消息布局从气泡样式改为 Discord 的紧凑列表样式（头像 + 用户名 + 时间戳 + 消息内容）
- 消息分组：同一用户连续消息合并显示（仅首条显示头像和用户名）
- 消息操作悬浮工具栏（表情反应、回复、更多）
- 新消息分隔线（红色 "NEW" 标记）

### 服务器设置与角色权限

- 服务器设置页面（概览、角色管理、频道管理、成员管理）
- 基于 Matrix 的 power levels 映射角色权限系统
- 频道权限覆盖（per-channel permission overrides）

## Capabilities

### New Capabilities

- `server-list`: 服务器（Space）列表的展示、排序、未读状态管理，包含 DM 入口
- `channel-sidebar`: 频道侧栏，含频道分类树、文字/语音频道列表、频道上下文菜单
- `discord-layout`: Discord 四栏布局框架，替代现有的三栏布局
- `discord-theme`: Discord 风格暗色主题和颜色体系
- `discord-messages`: Discord 风格的消息列表和消息项渲染
- `member-panel`: 右侧成员列表面板，含角色分组、在线状态、用户卡片
- `voice-channel-ui`: 语音频道显示和语音连接状态栏
- `server-settings`: 服务器设置、角色权限管理、频道管理

### Modified Capabilities

<!-- 项目尚无已有 specs，无需修改 -->

## Impact

### 代码影响

- **大规模重构** `src/shared/components/AppLayout.vue` 和 `src/shared/components/Sidebar.vue`
- **重写** `src/features/chat/components/ChatPage.vue`、`ConversationList.vue`、`ConversationItem.vue`
- **重写** `src/features/chat/components/MessageList.vue`、`MessageBubble.vue` 的渲染样式
- **新增** `src/matrix/spaces.ts` — Matrix Spaces API 封装
- **新增** `src/features/server/` — 服务器相关组件、store、composables
- **修改** `src/features/chat/stores/chatStore.ts` — 新增 serverId、channelId 等状态
- **修改** `src/app/router/index.ts` — 路由结构需适配 server/channel 层级
- **修改** `src/app/main.css` — 完全重新设计颜色变量体系

### 依赖影响

- 无需新增外部依赖，现有技术栈（Vue 3 + Tailwind CSS 4 + Radix Vue + LiveKit）完全满足需求
- 需要 Matrix homeserver 支持 Spaces（MSC1772，已在 Synapse/Conduit 中稳定支持）

### 兼容性

- **BREAKING**: 布局和导航结构完全重构，所有现有功能页面需要适配新布局
- 路由从 `/chat/:roomId` 变为 `/server/:serverId/channel/:channelId` 形式
- DM 路由保持 `/dm/:roomId` 独立入口
- 现有 Matrix 房间数据完全兼容，Spaces 为增量功能
