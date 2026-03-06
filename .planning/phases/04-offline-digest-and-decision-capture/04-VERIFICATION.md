---
phase: 04-offline-digest-and-decision-capture
verified: 2026-03-06T05:30:00Z
status: human_needed
score: 15/15 must-haves verified
human_verification:
  - test: "真实离线 digest/decision/qa 统一入口流程"
    expected: "DM 侧栏可打开 Knowledge，默认 digest，可切换 decision/qa，并在真实运行态完成离线回顾与知识录入"
    why_human: "需要真实桌面 UI、侧栏交互与离线/回归使用节奏，静态代码与组件测试无法完全覆盖"
  - test: "真实 citations 回跳与 joined-room 授权边界"
    expected: "digest 与 QA 的 citation 点击后能定位到目标消息；跨会话 QA 只基于当前 joined 会话的消息回答"
    why_human: "需要真实 Matrix 数据、路由定位与账号 membership 状态，mock 无法等价证明"
---

# Phase 4: Offline Digest and Decision Capture Verification Report

**Phase Goal:** 用户可以在离线回归时快速理解关键信息，并把讨论结论沉淀为可追溯知识资产。  
**Verified:** 2026-03-06T05:30:00Z  
**Status:** human_needed  
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | 用户返回后可以查看离线期间的精简 digest，并按 responsibility/follow/mention 排序重点。 | ✓ VERIFIED | `src/matrix/digest.ts:11-24` 只 materialize offline window 内事件；`src/features/chat/stores/digestStore.ts:21-33,43-69` 生成 digest session、持久化 entries 并按 relevance 排序；`tests/unit/stores/digestStore.test.ts:26-71` 覆盖离线窗口聚合与排序规则。 |
| 2 | 用户可以从 digest 条目打开源消息引用验证摘要结论。 | ✓ VERIFIED | `src/features/chat/components/OfflineDigestPanel.vue:20-34,74-85` 复用 `loadInboxEventContext + focusEventId`；`tests/components/OfflineDigestPanel.test.ts:68-113` 覆盖预加载成功与失败降级导航。 |
| 3 | 用户可以创建包含结论、背景、owner、状态和关联消息的决策卡。 | ✓ VERIFIED | `src/features/chat/types/knowledge.ts:51-62` 定义 decision card 必填字段与 citations；`src/features/chat/stores/decisionStore.ts:21-26` 通过 store action 创建并持久化；`tests/unit/stores/decisionStore.test.ts:26-47` 与 `tests/components/DecisionPanel.test.ts:35-47` 覆盖创建链路。 |
| 4 | 用户可以对 AI 建议行动项/阻塞项执行 accept 或 reject，并保留审计痕迹。 | ✓ VERIFIED | `src/features/chat/types/knowledge.ts:38-47` 规定 disposition/audit 字段；`src/features/chat/stores/decisionStore.ts:28-53` 限制只能转为 accepted/rejected 并写回 updatedBy/updatedAt；`tests/unit/stores/decisionStore.test.ts:49-92` 与 `tests/components/DecisionPanel.test.ts:49-85` 验证状态转移与 UI 调用。 |
| 5 | 用户可以提出跨会话问题并获得带可追溯 citations 的回答，且这些能力都可从统一 Knowledge 入口访问。 | ✓ VERIFIED | `src/features/chat/services/crossSessionQa.ts:7-34` 基于 `searchRoomEvents` 生成 citation-backed answer 并持久化；`src/features/chat/components/CrossSessionQaPanel.vue:17-45,67-95` 提供问答与 citation 回跳；`src/features/chat/components/KnowledgeCapturePanel.vue:23-75` 统一 digest/decision/qa 三个 tab；`src/features/chat/stores/chatStore.ts:42-58`、`src/features/chat/components/ChatWindow.vue:51-84`、`src/features/server/components/ChannelSidebar.vue:95-100,177-184` 完成 Knowledge 侧栏入口接线；`tests/unit/services/crossSessionQa.test.ts:17-61` 与 `tests/components/CrossSessionQaPanel.test.ts:46-105` 覆盖问答、citation 跳转和 side-panel 集成。 |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/features/chat/types/knowledge.ts` | Shared citation-first contracts for digest / decision / QA | ✓ VERIFIED | 文件存在（80 行），定义 `CitationRef`、`DigestEntry`、`DecisionCard`、`CrossSessionQaAnswer` 及 `pending/accepted/rejected` 约束。 |
| `src/shared/lib/knowledgeDb.ts` | Indexed Dexie persistence for digest / decisions / QA sessions | ✓ VERIFIED | 文件存在（120 行），`version(1).stores(...)` 为 `digestEntries/decisions/qaSessions` 建立索引，仓储封装保存与查询。 |
| `src/features/chat/stores/digestStore.ts` | Away-window digest materialization and relevance filtering | ✓ VERIFIED | 文件存在（82 行），实现 `buildDigestSession`、`visibleEntries`、`setFilter`。 |
| `src/features/chat/components/OfflineDigestPanel.vue` | Digest UI with citation jump flow | ✓ VERIFIED | 文件存在（93 行），渲染 digest 条目与 citation 按钮，点击后跳转源消息。 |
| `src/features/chat/stores/decisionStore.ts` | Decision card CRUD and suggestion disposition transitions | ✓ VERIFIED | 文件存在（60 行），所有决策变更经 store action 持久化。 |
| `src/features/chat/components/DecisionPanel.vue` | Decision capture UI with accept/reject actions | ✓ VERIFIED | 文件存在（100 行），支持创建 decision card 与 disposition 操作。 |
| `src/features/chat/services/crossSessionQa.ts` | Joined-room scoped cross-session QA service | ✓ VERIFIED | 文件存在（35 行），复用 `searchRoomEvents` 检索证据并保存 QA session。 |
| `src/features/chat/components/CrossSessionQaPanel.vue` | QA UI with cited answers and citation jumps | ✓ VERIFIED | 文件存在（98 行），支持提问、回答渲染、citation 跳转。 |
| `src/features/chat/components/KnowledgeCapturePanel.vue` | Single knowledge side-panel hosting digest / decision / qa | ✓ VERIFIED | 文件存在（77 行），统一 tab 容器已接入三个子面板。 |
| `tests/unit/stores/knowledgeDb.test.ts` | Contract coverage for shared knowledge persistence | ✓ VERIFIED | 文件存在（162 行），覆盖 citation 合同、Dexie stores、suggestion disposition 审计。 |
| `tests/unit/stores/digestStore.test.ts` | Digest session and relevance coverage | ✓ VERIFIED | 文件存在（72 行），覆盖离线窗口聚合与排序。 |
| `tests/components/OfflineDigestPanel.test.ts` | Digest UI and citation navigation coverage | ✓ VERIFIED | 文件存在（115 行），覆盖 citation preload/fallback。 |
| `tests/unit/stores/decisionStore.test.ts` | Decision workflow coverage | ✓ VERIFIED | 文件存在（93 行），覆盖创建、合法状态迁移、审计字段。 |
| `tests/components/DecisionPanel.test.ts` | Decision UI coverage | ✓ VERIFIED | 文件存在（86 行），覆盖创建、accept、reject 交互。 |
| `tests/unit/services/crossSessionQa.test.ts` + `tests/components/CrossSessionQaPanel.test.ts` | QA service + UI coverage | ✓ VERIFIED | 两个测试文件存在（62 行 + 106 行），覆盖 cited answer、joined-room scoped retrieval、citation 跳转与 Knowledge 集成。 |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `src/shared/lib/knowledgeDb.ts` | Dexie | versioned indexed schema | ✓ WIRED | `knowledgeDb.ts:16-30` 定义 `digestEntries/decisions/qaSessions` store 与 citation 索引。 |
| `src/features/chat/stores/digestStore.ts` | `src/matrix/digest.ts` | offline window materialization | ✓ WIRED | `digestStore.ts:43-69` 调用 `materializeOfflineDigest(...)` 构建 session。 |
| `src/features/chat/components/OfflineDigestPanel.vue` | `@matrix/index` | preload + `focusEventId` navigation | ✓ WIRED | `OfflineDigestPanel.vue:20-34` 在 citation 点击时先 preload，再路由跳转。 |
| `src/features/chat/stores/decisionStore.ts` | `src/shared/lib/knowledgeDb.ts` | decision persistence + suggestion updates | ✓ WIRED | `decisionStore.ts:21-26,36-52` 保存 decision 并统一更新 suggestion disposition。 |
| `src/features/chat/services/crossSessionQa.ts` | `@/matrix/retrieval` | joined-room scoped evidence retrieval | ✓ WIRED | `crossSessionQa.ts:7-18` 通过 `searchRoomEvents(question, limit)` 取证；对应单测 `crossSessionQa.test.ts:42-61` 验证调用边界。 |
| `src/features/chat/components/CrossSessionQaPanel.vue` | `@matrix/index` + router | citation preload + fallback navigation | ✓ WIRED | `CrossSessionQaPanel.vue:31-45` 复用 `loadInboxEventContext` 并传 `focusEventId`。 |
| `src/features/server/components/ChannelSidebar.vue` | `src/features/chat/stores/chatStore.ts` | single Knowledge side-panel entry | ✓ WIRED | `ChannelSidebar.vue:99-100,177-184` 调用 `toggleSidePanel('knowledge')`；`chatStore.ts:42-58` 接受 `knowledge` 状态；`ChatWindow.vue:82-83` 挂载面板。 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| DIGE-01 | 04-01, 04-02 | User can view an offline catch-up digest for activity during their away window. | ✓ SATISFIED | 共享合同/仓储底座（`knowledge.ts:24-36`, `knowledgeDb.ts:61-83`）+ digest materializer/store/UI（`matrix/digest.ts:11-24`, `digestStore.ts:43-69`, `OfflineDigestPanel.vue:37-91`）+ 测试（`digestStore.test.ts:26-52`, `OfflineDigestPanel.test.ts:50-66`）。 |
| DIGE-02 | 04-01, 04-02 | User can open source citations from digest entries to verify each summary claim. | ✓ SATISFIED | citation-first schema（`knowledge.ts:16-34`）+ digest citation jump（`OfflineDigestPanel.vue:20-34,74-85`）+ 组件测试（`OfflineDigestPanel.test.ts:68-113`）。 |
| DIGE-03 | 04-01, 04-02 | User can sort digest focus by personal relevance (my responsibility, my follows, my mentions). | ✓ SATISFIED | relevance priority（`types/digest.ts:23-27,52-58`）+ store visible sort（`digestStore.ts:21-33`）+ 单测（`digestStore.test.ts:54-71`）。 |
| DECI-01 | 04-01, 04-03 | User can create a decision card with conclusion, context, owner, status, and linked messages. | ✓ SATISFIED | decision 合同（`knowledge.ts:51-62`, `types/decision.ts:19-56`）+ store/UI（`decisionStore.ts:21-26`, `DecisionPanel.vue:16-25,44-55`）+ 测试（`decisionStore.test.ts:26-47`, `DecisionPanel.test.ts:35-47`）。 |
| DECI-02 | 04-01, 04-03 | User can accept or reject AI-suggested action items and blockers extracted from summaries. | ✓ SATISFIED | suggestion disposition 约束（`knowledge.ts:38-47`）+ store 只允许 pending → accepted/rejected（`decisionStore.ts:28-53`）+ 测试（`decisionStore.test.ts:49-92`, `DecisionPanel.test.ts:49-85`）。 |
| DECI-03 | 04-01, 04-04 | User can ask a cross-conversation question and receive an answer with traceable citations. | ✓ SATISFIED | shared QA contract（`knowledge.ts:66-80`）+ retrieval-backed QA service（`crossSessionQa.ts:7-34`）+ QA panel/Knowledge 集成（`CrossSessionQaPanel.vue:17-95`, `KnowledgeCapturePanel.vue:23-75`, `ChatWindow.vue:51-84`, `ChannelSidebar.vue:177-184`）+ 测试（`crossSessionQa.test.ts:17-61`, `CrossSessionQaPanel.test.ts:46-105`）。 |

Orphaned requirement IDs for Phase 4 in `REQUIREMENTS.md`: **None** (`DIGE-01`, `DIGE-02`, `DIGE-03`, `DECI-01`, `DECI-02`, `DECI-03` 均出现在 PLAN frontmatter 且已实现)。

### Automated Verification

- ✅ `pnpm vitest run tests/unit/stores/knowledgeDb.test.ts tests/unit/stores/digestStore.test.ts tests/unit/stores/decisionStore.test.ts tests/unit/services/crossSessionQa.test.ts tests/components/OfflineDigestPanel.test.ts tests/components/DecisionPanel.test.ts tests/components/CrossSessionQaPanel.test.ts`
  - Result: 7 test files passed, 19 tests passed.
- ⚠️ `pnpm test:unit`
  - Result: Phase 4 tests passed, but the suite still has an unrelated existing failure in `tests/components/MessageBubble.test.ts` caused by `AnimatedEmoji.vue` importing `lottie-web`, which requires a canvas context in jsdom (`TypeError: Cannot set properties of null (setting 'fillStyle')`).
  - Evidence: `MessageBubble.vue:44,567-570` imports/renders `AnimatedEmoji`; repro with `pnpm vitest run tests/components/MessageBubble.test.ts` fails before any Phase 4 code is exercised.
  - Scope note: `git log -- src/features/chat/components/MessageBubble.vue tests/components/MessageBubble.test.ts` shows no Phase 4 changes to those files.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `src/features/chat/components/OfflineDigestPanel.vue` | 24-25 | `console.warn` on preload fallback | ℹ️ Info | 与既有回跳降级策略一致；失败时仍允许导航，不阻断用户完成验证。 |
| `src/features/chat/components/CrossSessionQaPanel.vue` | 35-36 | `console.warn` on preload fallback | ℹ️ Info | 与全局搜索 / 任务回跳模式一致，用于记录 preload 降级。 |

### Human Verification Required

### 1. 真实离线回归知识流

**Test:** 在真实应用中离线一段时间后回到 DM，打开 Knowledge 侧栏，确认 digest 默认可见，可切换到 decision/qa，并能创建一张 decision card。  
**Expected:** 侧栏入口稳定、digest 有内容、tab 切换正常、决策卡创建后继续留在 Knowledge 工作流中。  
**Why human:** 需要真实 UI 与使用节奏；mock/单测无法覆盖桌面运行时的交互体验。

### 2. 真实 citations 与授权边界

**Test:** 在真实 Matrix 数据中分别点击 digest citation 与 QA citation，并用一个只加入部分房间的账号执行跨会话提问。  
**Expected:** 点击后定位到目标消息；QA 回答仅引用当前 joined 会话内容，不出现 leave/invite 会话信息。  
**Why human:** 需要真实 homeserver membership、时间线滚动和路由定位行为，静态验证无法完全证明。

### Gaps Summary

Phase 4 本身的 must-haves 已全部落地，且相关 focused tests 全绿，因此没有发现新的 Phase 4 实现缺口。本次状态仍为 `human_needed`，原因有两点：

1. 仍需要真实环境确认 Knowledge 统一入口、citation 回跳和 joined-room 边界体验；
2. 仓库当前 `pnpm test:unit` 仍受一个与本阶段无关的既有 `MessageBubble`/`lottie-web` jsdom 失败影响，因此暂不适合直接执行 phase complete。

---

_Verified: 2026-03-06T05:30:00Z_  
_Verifier: Claude (manual execute-phase verification)_
