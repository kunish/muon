# Muon — Discord-化里程碑

## What This Is

Muon 是一个基于 Matrix 协议的桌面端聊天应用（Vue 3 + Tauri 2），目前具备飞书风格的聊天、音视频通话和通讯录功能。本里程碑目标是将 Muon 全面 Discord 化——引入经典的 Server/Channel 层级结构、完整角色权限系统、常驻语音频道、社交功能增强和 Bot 生态，使其成为一个功能完整的 Discord 替代品。

## Core Value

用户可以创建和加入 Server，在 Channel 中进行文字/语音交流，并通过角色权限系统管理社区——这是 Discord 体验的核心三角。

## Requirements

### Validated

- ✓ 私聊和群聊 (DM/Group) — existing
- ✓ 富文本消息发送/接收（文字/图片/视频/音频/文件/GIF/贴纸）— existing
- ✓ 消息编辑/撤回/回复/转发/Reaction — existing
- ✓ @提及和 Thread 消息串 — existing
- ✓ 音视频通话（LiveKit）和屏幕共享 — existing
- ✓ E2EE 端到端加密 — existing
- ✓ 联系人管理和群组管理 — existing
- ✓ 设置中心（主题/语言/通知/免打扰）— existing
- ✓ 用户自定义状态 — quick-001
- ✓ 用户屏蔽/拉黑 — quick-001
- ✓ 消息搜索/置顶/收藏 — existing
- ✓ 已读回执和正在输入指示器 — existing
- ✓ 消失消息 — existing
- ✓ 国际化 (中/英) — existing

### Active

- [ ] Server/Space 层级结构（基于 Matrix Space）
- [ ] Channel 体系（文字/语音/分类）
- [ ] 完整角色权限系统（角色创建/分配/颜色/层级/权限控制）
- [ ] 常驻语音频道（加入即通话，基于 LiveKit）
- [ ] 经典 Discord 四栏布局（Server列表 > Channel列表 > 聊天区 > 成员列表）
- [ ] 好友系统（请求/接受/拒绝/好友列表）
- [ ] 消息 Markdown 渲染（代码块语法高亮、粗体、斜体、删除线、引用块）
- [ ] 慢速模式（管理员设置发消息时间间隔限制）
- [ ] 邀请链接系统（生成/管理/过期时间/使用次数）
- [ ] 审计日志（Server 事件审计记录）
- [ ] Bot 系统（Bot 账户、Webhook、斜杠命令）
- [ ] 公开 Server 发现（浏览/搜索公开 Server）

### Out of Scope

- Server Boost/付费功能 — 不涉及商业化
- Stage Channel（舞台频道）— 复杂度高，非 MVP 必需
- Forum Channel（论坛频道）— 可后续迭代
- Server 模板 — 后续迭代
- AutoMod 自动审核 — 后续迭代
- 直播/Go Live — 后续迭代
- 移动端适配 — 桌面端优先
- OAuth/第三方登录 — Matrix 自有认证即可

## Context

**现有技术栈：**
- 前端：Vue 3 + Pinia 3 + Vue Router 5 + TailwindCSS 4 + Radix Vue + TipTap
- 桌面：Tauri 2
- 协议：Matrix JS SDK 41.x
- 实时通信：LiveKit Client 2.x
- UI：Lucide Icons + Lottie Web
- 构建：Vite 7 + TypeScript 5

**项目结构：**
- `src/features/` — 按功能领域模块化（chat, calls, contacts, settings）
- `src/matrix/` — Matrix 协议封装层（14 个模块）
- `src/shared/` — 共享组件和工具
- `src/app/` — 应用入口和路由

**现有规模：**
- Chat 模块：50+ 组件，11 个 composables
- Calls 模块：基于 LiveKit 的完整通话功能
- Matrix 层：auth, client, crypto, events, media, messages, profile, receipts, rooms, sync, types, typing, verification, blocking

**关键依赖：**
- Matrix Space API 用于 Server/Channel 层级
- Matrix power levels 用于角色权限映射
- LiveKit 用于常驻语音频道
- TipTap 需扩展支持 Markdown 渲染

## Constraints

- **协议**: 必须基于 Matrix 协议实现，利用 Space/Room/Power Level 等原生概念
- **兼容性**: 新功能不能破坏现有聊天功能，需要平滑迁移
- **UI 框架**: 继续使用 Radix Vue + TailwindCSS 4，不引入新的 UI 框架
- **布局迁移**: 从飞书风格迁移到 Discord 四栏布局，需要重构 AppLayout 和 Sidebar
- **存储**: 沿用现有 Dexie (IndexedDB) + idb-keyval 方案
- **国际化**: 所有新文本必须同时支持中文和英文

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 基于 Matrix Space 实现 Server 概念 | Matrix Space 是 Room 的层级容器，天然映射 Discord Server > Channel | — Pending |
| 采用经典 Discord 四栏布局 | 用户期望 Discord 体验，布局是核心辨识度 | — Pending |
| 完整角色权限而非简化版 | 角色权限是 Discord 社区治理的核心，简化版无法满足需求 | — Pending |
| 常驻语音频道 (非点对点) | Discord 标志性功能，通过 LiveKit Room 实现常驻语音 | — Pending |
| Bot 系统纳入 MVP | Bot 生态是 Discord 生命力的来源，早期引入有利于社区建设 | — Pending |

---
*Last updated: 2026-03-03 after initialization*
