---
phase: quick-001
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  # Matrix 层
  - src/matrix/profile.ts
  - src/matrix/index.ts
  # 自定义状态
  - src/features/settings/components/ProfileSettings.vue
  - src/features/settings/components/StatusPicker.vue
  - src/features/contacts/components/ContactItem.vue
  - src/features/contacts/components/UserProfile.vue
  - src/features/chat/components/UserInfoPanel.vue
  - src/features/chat/components/MemberListPanel.vue
  - src/features/chat/components/ConversationItem.vue
  # 用户屏蔽
  - src/matrix/blocking.ts
  - src/features/settings/components/SecuritySettings.vue
  - src/features/settings/components/BlockedUsers.vue
  - src/features/chat/components/MessageBubble.vue
  # 国际化
  - src/locales/zh.json
  - src/locales/en.json
autonomous: true
requirements: [STATUS-01, BLOCK-01]

must_haves:
  truths:
    - "用户可以在个人资料页设置自定义状态文本（含 emoji）"
    - "自定义状态在联系人列表、用户信息面板、成员列表中可见"
    - "自定义状态跨会话持久化（使用 Matrix presence statusMsg）"
    - "用户可以通过 UserInfoPanel 屏蔽/解除屏蔽其他用户"
    - "被屏蔽用户的消息被隐藏（不可见）"
    - "设置 > 安全页面展示已屏蔽用户列表并支持解除屏蔽"
  artifacts:
    - path: "src/matrix/profile.ts"
      provides: "setMyStatus / getMyStatus 函数"
    - path: "src/matrix/blocking.ts"
      provides: "blockUser / unblockUser / getBlockedUsers / isUserBlocked 函数"
    - path: "src/features/settings/components/StatusPicker.vue"
      provides: "状态选择弹窗组件"
    - path: "src/features/settings/components/BlockedUsers.vue"
      provides: "已屏蔽用户列表组件"
  key_links:
    - from: "src/features/settings/components/ProfileSettings.vue"
      to: "src/matrix/profile.ts"
      via: "setMyStatus() 调用"
    - from: "src/features/chat/components/UserInfoPanel.vue"
      to: "src/matrix/blocking.ts"
      via: "blockUser() / unblockUser() 调用"
    - from: "src/features/chat/components/MessageBubble.vue"
      to: "src/matrix/blocking.ts"
      via: "isUserBlocked() 隐藏消息"
---

<objective>
为 Muon 添加两个社交功能：用户自定义状态和用户屏蔽/拉黑。

Purpose: 提升用户社交体验——自定义状态让用户可以表达当前状态（如「🎮 游戏中」「🏖️ 度假中」），屏蔽功能让用户控制自己的社交边界。
Output: Matrix 层 API、UI 组件、国际化文本
</objective>

<execution_context>
@/Users/shikun/.config/opencode/get-shit-done/workflows/execute-plan.md
@/Users/shikun/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/matrix/profile.ts
@src/matrix/client.ts
@src/matrix/index.ts
@src/matrix/types.ts
@src/features/settings/components/ProfileSettings.vue
@src/features/settings/components/SecuritySettings.vue
@src/features/settings/components/SettingsPage.vue
@src/features/contacts/components/ContactItem.vue
@src/features/contacts/components/UserProfile.vue
@src/features/chat/components/UserInfoPanel.vue
@src/features/chat/components/MemberListPanel.vue
@src/features/chat/components/ConversationItem.vue
@src/features/chat/components/MessageBubble.vue
@src/features/chat/components/ConversationContextMenu.vue
@src/locales/zh.json
@src/locales/en.json

<interfaces>
<!-- 现有 Matrix profile API（src/matrix/profile.ts）-->
```typescript
export function getMyDisplayName(): string
export function getMyAvatarUrl(): string | undefined
export async function setMyDisplayName(name: string): Promise<void>
export async function setMyAvatar(file: File): Promise<void>
export function getUserPresenceInfo(userId: string): {
  presence: string
  lastActiveAgo?: number
  statusMsg?: string  // ← 这就是自定义状态的存储字段
}
```

<!-- 现有 Matrix client（src/matrix/client.ts）-->
```typescript
export function getClient(): sdk.MatrixClient
// MatrixClient 提供：
// - client.setPresence({ presence: "online", status_msg: "..." })
// - client.getAccountData('m.ignored_user_list')
// - client.setAccountData('m.ignored_user_list', { ignored_users: {...} })
// - client.getUser(userId)?.presenceStatusMsg
```

<!-- 现有 Contact 类型（src/features/contacts/stores/contactStore.ts）-->
```typescript
export interface Contact {
  userId: string
  displayName: string
  avatarUrl?: string
  presence: 'online' | 'offline' | 'unavailable'
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Matrix 层 API + 自定义状态 UI</name>
  <files>
    src/matrix/profile.ts
    src/matrix/index.ts
    src/features/settings/components/StatusPicker.vue
    src/features/settings/components/ProfileSettings.vue
    src/features/contacts/components/ContactItem.vue
    src/features/contacts/components/UserProfile.vue
    src/features/chat/components/UserInfoPanel.vue
    src/features/chat/components/MemberListPanel.vue
    src/features/chat/components/ConversationItem.vue
    src/locales/zh.json
    src/locales/en.json
  </files>
  <action>
**1. 扩展 `src/matrix/profile.ts`，添加自定义状态 API：**

```typescript
/** 设置当前用户的自定义状态（emoji + 文本） */
export async function setMyStatus(statusMsg: string): Promise<void> {
  const client = getClient()
  await client.setPresence({ presence: 'online', status_msg: statusMsg })
}

/** 获取当前用户的自定义状态 */
export function getMyStatus(): string {
  const client = getClient()
  const userId = client.getUserId()
  if (!userId) return ''
  const user = client.getUser(userId)
  return user?.presenceStatusMsg || ''
}

/** 清除自定义状态 */
export async function clearMyStatus(): Promise<void> {
  const client = getClient()
  await client.setPresence({ presence: 'online', status_msg: '' })
}
```

**2. 在 `src/matrix/index.ts` 中导出新函数：**
在现有 profile 导出行中追加 `setMyStatus, getMyStatus, clearMyStatus`。

**3. 创建 `src/features/settings/components/StatusPicker.vue`：**
- 使用 Radix Vue 的 Popover 或直接用项目已有的 `popover.vue` 组件
- 点击当前状态区域弹出选择器
- 提供输入框让用户输入自定义状态文本（最大 100 字符）
- 提供一行常用 emoji 快捷选择：😊🎮📚🏖️💼🎵🏃☕🌙✈️
- 提供"清除状态"按钮
- 调用 `setMyStatus()` 保存，调用 `clearMyStatus()` 清除
- 样式跟随项目设计风格（rounded-lg, text-sm, gap-2, 使用 TailwindCSS）

**4. 修改 `src/features/settings/components/ProfileSettings.vue`：**
- 在昵称区块下方添加"自定义状态"区块
- 显示当前状态文本（通过 `getMyStatus()` 获取），如果为空显示占位文字"设置自定义状态"
- 点击时打开 StatusPicker popover
- import 使用 `@matrix/index` 中的 `getMyStatus`

**5. 修改 `src/features/contacts/components/ContactItem.vue`：**
- 通过 `getUserPresenceInfo(contact.userId)` 获取 `statusMsg`
- 如果 statusMsg 存在，在 userId 那行下方显示 statusMsg（用 `text-xs text-muted-foreground/70 truncate` 样式）
- 超长状态 truncate 处理

**6. 修改 `src/features/contacts/components/UserProfile.vue`：**
- 在 presenceLabel 下方，如果 `presenceInfo.statusMsg` 存在，显示自定义状态文本
- 使用 `text-sm text-muted-foreground` 样式，最大宽度限制

**7. 修改 `src/features/chat/components/UserInfoPanel.vue`：**
- 在 userId 下方、信息行上方，如果用户有 statusMsg，显示它
- 通过 `getUserPresenceInfo(memberInfo.userId)` 获取
- 样式：`text-[11px] text-muted-foreground/70 mt-1 truncate max-w-full`

**8. 修改 `src/features/chat/components/MemberListPanel.vue`：**
- 在 MemberInfo 接口中添加 `statusMsg?: string`
- 在构建 members 时，通过 `getClient().getUser(m.userId)?.presenceStatusMsg` 获取
- 在成员 userId 下方，如果有 statusMsg，显示它（`text-[10px] text-muted-foreground/50 truncate`）

**9. 修改 `src/features/chat/components/ConversationItem.vue`（仅 DM 会话）：**
- 不改变主要布局，仅在 DM 会话且对方有 statusMsg 时，在消息预览前缀显示截断的状态文字作为辅助信息
- 这个改动可选——如果影响布局太大则跳过

**10. 添加 i18n 文本到 `zh.json` 和 `en.json`：**

zh.json `settings` 区块内追加：
```json
"status": "自定义状态",
"status_placeholder": "设置自定义状态...",
"status_clear": "清除状态",
"status_hint": "让其他人知道你在做什么"
```

en.json `settings` 区块内追加：
```json
"status": "Custom Status",
"status_placeholder": "Set a custom status...",
"status_clear": "Clear Status",
"status_hint": "Let others know what you're up to"
```
  </action>
  <verify>
    <automated>npx vue-tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - ProfileSettings 页面显示自定义状态区块，可点击打开 StatusPicker
    - StatusPicker 支持输入文本、选择 emoji、清除状态
    - 状态通过 Matrix presence statusMsg 持久化
    - ContactItem、UserProfile、UserInfoPanel、MemberListPanel 均可展示用户自定义状态
    - 所有 UI 文本已国际化（zh + en）
    - TypeScript 编译无错误
  </done>
</task>

<task type="auto">
  <name>Task 2: 用户屏蔽/拉黑功能</name>
  <files>
    src/matrix/blocking.ts
    src/matrix/index.ts
    src/features/settings/components/SecuritySettings.vue
    src/features/settings/components/BlockedUsers.vue
    src/features/chat/components/UserInfoPanel.vue
    src/features/chat/components/MessageBubble.vue
    src/locales/zh.json
    src/locales/en.json
  </files>
  <action>
**1. 创建 `src/matrix/blocking.ts`：**

```typescript
import { getClient } from './client'

/** 获取已屏蔽用户列表 */
export function getBlockedUsers(): string[] {
  const client = getClient()
  const event = client.getAccountData('m.ignored_user_list' as any)
  const content = event?.getContent() as { ignored_users?: Record<string, object> } | undefined
  return Object.keys(content?.ignored_users ?? {})
}

/** 检查用户是否被屏蔽 */
export function isUserBlocked(userId: string): boolean {
  return getBlockedUsers().includes(userId)
}

/** 屏蔽用户 */
export async function blockUser(userId: string): Promise<void> {
  const client = getClient()
  const current = getBlockedUsers()
  if (current.includes(userId)) return
  const ignored_users: Record<string, object> = {}
  for (const uid of [...current, userId]) {
    ignored_users[uid] = {}
  }
  await client.setAccountData('m.ignored_user_list' as any, { ignored_users })
}

/** 解除屏蔽 */
export async function unblockUser(userId: string): Promise<void> {
  const client = getClient()
  const current = getBlockedUsers()
  const ignored_users: Record<string, object> = {}
  for (const uid of current) {
    if (uid !== userId) ignored_users[uid] = {}
  }
  await client.setAccountData('m.ignored_user_list' as any, { ignored_users })
}
```

**2. 在 `src/matrix/index.ts` 追加导出：**
```typescript
export { blockUser, unblockUser, getBlockedUsers, isUserBlocked } from './blocking'
```

**3. 创建 `src/features/settings/components/BlockedUsers.vue`：**
- 使用 `getBlockedUsers()` 获取列表并展示
- 每行显示用户 ID + "解除屏蔽"按钮
- 解除屏蔽调用 `unblockUser(userId)` 后刷新列表
- 空列表时显示"暂无屏蔽用户"占位文本
- 使用 `UserX` (lucide) 图标

**4. 修改 `src/features/settings/components/SecuritySettings.vue`：**
- 在 DeviceList 上方（或下方），添加"已屏蔽用户"区块
- import 并使用 BlockedUsers 组件
- 添加 `UserX` 图标和标题行

**5. 修改 `src/features/chat/components/UserInfoPanel.vue`：**
- 在"发送消息"按钮区域，添加一个"屏蔽用户"/"解除屏蔽"按钮
- 仅对非自己的用户显示（`memberInfo.userId !== getClient().getUserId()`）
- 使用 `Ban` 图标 (lucide)
- 屏蔽后按钮变为"解除屏蔽"状态（红色警示样式）
- 屏蔽操作前使用 `@tauri-apps/plugin-dialog` 的 `ask()` 确认
- 已屏蔽用户的 UserInfoPanel 上方显示一个红色横幅提示"此用户已被屏蔽"

**6. 修改 `src/features/chat/components/MessageBubble.vue`：**
- 在消息渲染前检查 `isUserBlocked(event.getSender())` 
- 如果被屏蔽，不渲染消息气泡（直接隐藏，使用 `v-if`）
- 注意：需要从 `@matrix/index` 导入 `isUserBlocked`
- 考虑性能：使用 computed 缓存 blocked 状态，避免每条消息都调用

**7. 添加 i18n 文本：**

zh.json `settings` 区块追加：
```json
"blocked_users": "已屏蔽用户",
"blocked_users_desc": "被屏蔽的用户无法向你发送消息",
"no_blocked_users": "暂无屏蔽用户",
"unblock": "解除屏蔽",
"block_user": "屏蔽用户",
"block_confirm": "确定要屏蔽此用户吗？屏蔽后将不再收到对方的消息。",
"block_confirm_title": "屏蔽用户",
"user_blocked_banner": "此用户已被屏蔽",
"unblock_user": "解除屏蔽"
```

en.json `settings` 区块追加：
```json
"blocked_users": "Blocked Users",
"blocked_users_desc": "Blocked users cannot send you messages",
"no_blocked_users": "No blocked users",
"unblock": "Unblock",
"block_user": "Block User",
"block_confirm": "Are you sure you want to block this user? You will no longer receive their messages.",
"block_confirm_title": "Block User",
"user_blocked_banner": "This user is blocked",
"unblock_user": "Unblock"
```
  </action>
  <verify>
    <automated>npx vue-tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - `src/matrix/blocking.ts` 提供 blockUser / unblockUser / getBlockedUsers / isUserBlocked
    - UserInfoPanel 对非自己的用户显示"屏蔽"/"解除屏蔽"按钮
    - 屏蔽操作有确认对话框
    - 被屏蔽用户的消息在 MessageBubble 中隐藏（v-if 隐藏）
    - 设置 > 安全 页面展示已屏蔽用户列表，支持解除屏蔽
    - 已屏蔽用户的 UserInfoPanel 显示红色警示横幅
    - 所有 UI 文本已国际化（zh + en）
    - TypeScript 编译无错误
  </done>
</task>

</tasks>

<verification>
1. `npx vue-tsc --noEmit` — TypeScript 编译无错误
2. 打开设置 > 个人资料，验证自定义状态输入和显示
3. 打开设置 > 安全，验证已屏蔽用户列表
4. 在联系人列表中查看用户自定义状态是否显示
5. 点击 UserInfoPanel 中的屏蔽按钮，验证消息隐藏
</verification>

<success_criteria>
- 用户可在设置 > 个人资料中设置/清除自定义状态
- 自定义状态在所有用户展示位置可见（ContactItem、UserProfile、UserInfoPanel、MemberListPanel）
- 用户可通过 UserInfoPanel 屏蔽/解除屏蔽其他用户
- 被屏蔽用户的消息不可见
- 设置 > 安全中展示已屏蔽用户列表
- 所有新增文本已国际化
- TypeScript 编译通过
</success_criteria>

<output>
After completion, create `.planning/quick/001-custom-status-and-user-blocking/001-SUMMARY.md`
</output>
