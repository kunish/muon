## 1. 基础设施与主题

- [x] 1.1 重新定义 `src/app/main.css` 中的 CSS 变量体系，替换为 Discord 风格暗色配色（`--color-background`, `--color-sidebar`, `--color-foreground` 等）
- [x] 1.2 更新字体栈为 Discord 风格（`'gg sans', 'Noto Sans', Helvetica, Arial, sans-serif`）
- [x] 1.3 更新 `src/shared/components/ui/button.vue` 的变体样式（Blurple primary、灰色 secondary）
- [x] 1.4 调整所有 UI 原子组件（input, dialog, dropdown-menu, popover, tooltip, badge）适配新颜色变量
- [x] 1.5 保留 light 主题替代方案，更新 `useTheme` composable 使暗色为默认

## 2. Matrix Spaces API 封装

- [x] 2.1 创建 `src/matrix/spaces.ts`，实现 `getSpaceHierarchy(spaceId)` 获取 Space 层级结构
- [x] 2.2 实现 `createSpace(name, opts)` 创建新 Space（服务器/分类）
- [x] 2.3 实现 `addRoomToSpace(spaceId, roomId)` 和 `removeRoomFromSpace(spaceId, roomId)`
- [x] 2.4 实现 `getSpaceMembers(spaceId)` 获取 Space 成员列表及 power levels
- [x] 2.5 实现 `setSpacePowerLevels(spaceId, userId, level)` 设置成员权限
- [x] 2.6 在 `src/matrix/events.ts` 中添加 Space 相关事件桥接（`space.update`, `space.member`）
- [x] 2.7 定义 `src/matrix/types.ts` 中的 `SpaceInfo`, `ChannelInfo`, `CategoryInfo` 类型

## 3. 服务器 Store 与数据层

- [x] 3.1 创建 `src/features/server/stores/serverStore.ts`（Pinia），管理 `servers`, `currentServerId`, `serverOrder`, `channelTree`, `collapsedCategories`
- [x] 3.2 实现服务器列表加载逻辑：从 sync 数据中筛选顶级 Space 构建 `servers` Map
- [x] 3.3 实现频道树构建逻辑：解析 Space hierarchy 为 `ChannelCategory[]` 树结构
- [x] 3.4 实现服务器排序持久化（localStorage `muon_server_order`）
- [x] 3.5 实现「未分类」房间归类逻辑：不属于任何 Space 的房间归入虚拟分组
- [x] 3.6 实现 voice channel 识别逻辑：检查房间 state 中的 `im.muon.voice_channel` 事件
- [x] 3.7 实现 Space 事件监听，增量更新 `channelTree`（频道增删、成员变更）

## 4. 路由重构

- [x] 4.1 重构 `src/app/router/index.ts`，新增路由：`/server/:serverId/channel/:channelId`, `/dm/:roomId`, `/dm`
- [x] 4.2 实现路由守卫：切换服务器时恢复上次访问的频道（persisted in serverStore）
- [x] 4.3 移除旧的 `/chat/:roomId?` 路由，添加重定向兼容
- [x] 4.4 实现深度链接支持：从 URL 解析 serverId/channelId 并正确初始化状态

## 5. Discord 四栏布局

- [x] 5.1 重写 `src/shared/components/AppLayout.vue`：从「Sidebar + RouterView」改为「ServerList + ChannelSidebar + RouterView(ChatArea + MemberPanel)」
- [x] 5.2 创建 `src/features/server/components/ServerList.vue`（72px 垂直服务器图标列表）
- [x] 5.3 实现服务器图标组件 `ServerIcon.vue`：头像/首字母回退、hover 变圆角动画（150ms）、选中圆形 + 白色 pill 指示器
- [x] 5.4 实现服务器未读指示器：白点（普通未读）、红色数字角标（@提及）
- [x] 5.5 实现 Home/DM 图标入口（服务器列表顶部 + 分隔线）
- [x] 5.6 实现「+」创建服务器按钮和 CreateServerDialog 组件
- [x] 5.7 实现服务器列表拖拽排序（HTML5 Drag & Drop 或轻量库）

## 6. 频道侧栏

- [x] 6.1 创建 `src/features/server/components/ChannelSidebar.vue`（240px 频道侧栏容器）
- [x] 6.2 实现侧栏头部：服务器名称 + 下拉菜单触发（ServerDropdown）
- [x] 6.3 创建 `ServerDropdown.vue`：服务器设置、创建频道/分类、邀请、通知设置、离开服务器
- [x] 6.4 创建 `ChannelCategory.vue`：可折叠分类头部（大写文字 + chevron + hover 显示「+」）
- [x] 6.5 创建 `TextChannelItem.vue`：`#` 前缀、选中高亮、未读加粗、@提及角标
- [x] 6.6 创建 `VoiceChannelItem.vue`：speaker 图标、连接用户列表（头像 + 名称 + mute 状态）
- [x] 6.7 实现频道右键上下文菜单 `ChannelContextMenu.vue`
- [x] 6.8 创建 `CreateChannelDialog.vue`：输入频道名、选择类型（文字/语音）、设置私有
- [x] 6.9 实现 DM 模式：Home 选中时侧栏切换为 DM 列表（搜索 + Friends 入口 + DM 会话列表）

## 7. Discord 风格消息渲染

- [x] 7.1 创建 `src/features/chat/components/DiscordMessageGroup.vue`：消息分组容器，处理同用户 5 分钟内消息合并
- [x] 7.2 创建 `src/features/chat/components/DiscordMessage.vue`：紧凑布局（40px 头像 + 用户名/时间 + 内容），替代 MessageBubble 气泡样式
- [x] 7.3 实现续接消息样式：无头像无用户名，hover 时显示 HH:MM 时间戳
- [x] 7.4 创建消息悬浮操作栏 `MessageActionBar.vue`：表情反应、回复、更多（固定在消息右上角）
- [x] 7.5 实现 "NEW" 新消息分隔线（红色线 + "NEW" 文字标记）
- [x] 7.6 重新设计反应区域：pill 形状按钮（emoji + 计数 + Blurple 高亮己方反应 + "+" 添加按钮）
- [x] 7.7 重新设计回复引用样式：左侧竖线 + 小头像 + 用户名 + 截断原文
- [x] 7.8 重新设计系统消息样式：居中 muted 文字 + 图标前缀
- [x] 7.9 更新 `MessageList.vue`：集成新的 DiscordMessage 组件替代 MessageBubble

## 8. 聊天区域头部与输入

- [x] 8.1 重写 `ChatHeader.vue`：`# 频道名` + topic 文字 + 右侧操作按钮（置顶、成员列表 toggle、搜索）
- [x] 8.2 DM 头部样式：用户头像 + 名称 + 在线状态指示器
- [x] 8.3 更新 `RichTextInput.vue` 样式：Discord 风格输入框（圆角、placeholder "Message #channel-name"、左侧 "+" 附件按钮、右侧 emoji/gif/sticker 按钮）
- [x] 8.4 重新设计 `TypingIndicator.vue`："{User} is typing..." 格式 + 三点动画

## 9. 成员面板

- [x] 9.1 创建 `src/features/server/components/MemberPanel.vue`（240px 右侧面板，可折叠）
- [x] 9.2 实现成员按角色分组显示：角色头部（大写名称 + 在线人数）+ 成员列表
- [x] 9.3 实现成员条目组件 `MemberItem.vue`：32px 头像 + 角色颜色名称 + 状态指示器（10px，头像右下角）
- [x] 9.4 实现离线成员降低透明度（50%）且排在在线成员之后
- [x] 9.5 实现用户信息 popover `UserPopover.vue`：大头像、显示名、username、角色徽章、"Message" 按钮
- [x] 9.6 实现成员右键菜单 `MemberContextMenu.vue`：Profile、Message、Mention、管理员专有操作（Mute/Kick/Ban）
- [x] 9.7 实现面板 toggle 动画（200ms slide in/out）

## 10. 语音频道功能

- [x] 10.1 创建 `src/features/server/components/VoiceStatusBar.vue`：固定在频道侧栏底部，显示 "Voice Connected" + 频道名 + Mute/Deafen/Disconnect 按钮
- [x] 10.2 实现语音频道连接逻辑：复用 `useCall` composable + LiveKit，在 `serverStore` 中管理 `voiceConnections`
- [x] 10.3 实现语音频道切换：点击新语音频道时自动断开旧频道
- [x] 10.4 实现语音频道用户列表实时更新（监听 LiveKit participant 事件）
- [x] 10.5 实现语音频道人数限制显示（`X/Y` 格式 + 满员锁定图标）
- [x] 10.6 添加 `im.muon.voice_channel` room state event 的创建和读取逻辑到 `src/matrix/rooms.ts`

## 11. 服务器设置

- [x] 11.1 创建 `src/features/server/components/ServerSettings.vue`：设置页面容器（全屏覆盖，左侧导航 + 右侧内容）
- [x] 11.2 实现概览设置页 `ServerOverview.vue`：编辑服务器名称、头像、描述
- [x] 11.3 实现角色管理页 `RoleManager.vue`：角色列表、创建/编辑/删除角色、设置颜色和 power level
- [x] 11.4 实现角色持久化：使用自定义 state event `im.muon.roles` 存储角色定义到 Space
- [x] 11.5 实现频道管理页 `ChannelManager.vue`：频道列表、拖拽排序、编辑/删除频道
- [x] 11.6 实现成员管理页 `MemberManager.vue`：成员搜索、角色分配、踢出/封禁操作
- [x] 11.7 实现邀请对话框 `InviteDialog.vue`：显示服务器地址/别名，复制到剪贴板

## 12. 集成与清理

- [x] 12.1 移除旧组件：`Sidebar.vue`（60px 导航栏）、`ConversationList.vue`、`ConversationItem.vue` 中的飞书风格代码
- [x] 12.2 迁移剩余功能页面（Contacts, Calls, Calendar, Docs, Approvals, Email）到新布局中的入口
- [x] 12.3 更新 `useChatStore` 适配新布局：新增 `currentServerId` 关联、移除飞书风格的 `activeFilter`
- [x] 12.4 确保所有现有功能正常运行：加密消息、Thread、Reactions、贴纸、GIF、文件上传、搜索
- [x] 12.5 更新 i18n 翻译文件（`zh.json`, `en.json`）：添加服务器/频道/角色相关翻译
- [x] 12.6 运行 `vue-tsc --noEmit` 确保无类型错误
- [x] 12.7 运行 `eslint` 确保代码风格一致
- [x] 12.8 运行现有 Vitest 单元测试确保无回归
