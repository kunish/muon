---
phase: quick-001
plan: 01
subsystem: social-features
tags: [custom-status, user-blocking, matrix, vue, i18n]
dependency_graph:
  requires: [matrix-client, matrix-presence, matrix-account-data]
  provides: [custom-status-api, user-blocking-api, status-ui, blocking-ui]
  affects: [profile-settings, security-settings, contact-list, user-info-panel, member-list, message-bubble]
tech_stack:
  added: []
  patterns: [matrix-presence-statusMsg, matrix-ignored-user-list, vue-computed-caching]
key_files:
  created:
    - src/matrix/blocking.ts
    - src/features/settings/components/StatusPicker.vue
    - src/features/settings/components/BlockedUsers.vue
  modified:
    - src/matrix/profile.ts
    - src/matrix/index.ts
    - src/features/settings/components/ProfileSettings.vue
    - src/features/settings/components/SecuritySettings.vue
    - src/features/contacts/components/ContactItem.vue
    - src/features/contacts/components/UserProfile.vue
    - src/features/chat/components/UserInfoPanel.vue
    - src/features/chat/components/MemberListPanel.vue
    - src/features/chat/components/MessageBubble.vue
    - src/locales/zh.json
    - src/locales/en.json
decisions:
  - "Skipped ConversationItem.vue status display — plan marked it optional, complex layout"
  - "Used `as any` type assertion for setAccountData due to matrix-js-sdk type limitation"
  - "Block check in MessageBubble uses computed for performance caching"
metrics:
  duration: "~10 min"
  completed: "2026-03-03"
  tasks: "2/2"
  files_created: 3
  files_modified: 11
---

# Quick Task 001: Custom Status & User Blocking Summary

Matrix presence 自定义状态 + m.ignored_user_list 用户屏蔽，提供完整 API 层、UI 组件和双语国际化支持。

## What Was Built

### 自定义状态功能
- **Matrix API 层** (`src/matrix/profile.ts`): `setMyStatus()`, `getMyStatus()`, `clearMyStatus()` 通过 Matrix presence statusMsg 实现跨会话持久化
- **StatusPicker 组件**: Popover 弹窗带文本输入（100字限制）、常用 emoji 快捷选择（😊🎮📚🏖️💼🎵🏃☕🌙✈️）
- **ProfileSettings 集成**: 设置 > 个人资料页显示当前状态，点击打开 StatusPicker
- **状态展示**: ContactItem、UserProfile、UserInfoPanel、MemberListPanel 均展示用户自定义状态

### 用户屏蔽功能
- **Matrix API 层** (`src/matrix/blocking.ts`): `blockUser()`, `unblockUser()`, `getBlockedUsers()`, `isUserBlocked()` 基于 m.ignored_user_list account data
- **BlockedUsers 组件**: 设置 > 安全页面展示已屏蔽用户列表，支持单项解除屏蔽
- **UserInfoPanel 集成**: 非自己的用户显示「屏蔽/解除屏蔽」按钮，屏蔽前弹出确认对话框，已屏蔽用户显示红色警示横幅
- **消息隐藏**: MessageBubble 使用 v-if + computed 缓存隐藏被屏蔽用户的消息

### 国际化
- zh.json / en.json 新增 14 个翻译键，覆盖状态和屏蔽两个功能的所有 UI 文本

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Matrix 层 API + 自定义状态 UI | `c90b93c` | profile.ts, StatusPicker.vue, ProfileSettings.vue, ContactItem.vue, UserProfile.vue, UserInfoPanel.vue, MemberListPanel.vue |
| 2 | 用户屏蔽/拉黑功能 | `9c89052` | blocking.ts, BlockedUsers.vue, SecuritySettings.vue, UserInfoPanel.vue, MessageBubble.vue |

## Deviations from Plan

### Skipped (Optional)
**ConversationItem.vue DM 状态前缀** — 计划标注为可选("如果影响布局太大则跳过")，ConversationItem 已有复杂的内容展示逻辑（typing、draft、@mention、preview），添加状态前缀会影响布局且收益不大，予以跳过。

### Auto-fixed Issues
**1. [Rule 3 - Blocking] `setAccountData` 类型不兼容**
- **Found during:** Task 2
- **Issue:** matrix-js-sdk 的 `setAccountData` 泛型类型约束导致 `{ ignored_users }` 无法直接赋值为 `never` 类型
- **Fix:** 添加 `as any` 类型断言绕过 SDK 类型限制
- **Files modified:** src/matrix/blocking.ts

## Self-Check: PASSED

All 3 created files verified. All 11 modified files verified. Both commit hashes (c90b93c, 9c89052) confirmed in git log.
