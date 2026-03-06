---
phase: 04-offline-digest-and-decision-capture
verified: 2026-03-06T09:05:28Z
status: gaps_found
score: 4/9 must-haves verified
gaps:
  - truth: "用户重新打开离线知识面板时，可以稳定读取已保存的知识条目而不丢失历史内容。"
    status: failed
    reason: "知识仓储提供了 list API，但当前 digest/decision/qa 链路都只写入不回读；打开 Knowledge 面板不会恢复历史数据。"
    artifacts:
      - path: "src/shared/lib/knowledgeDb.ts"
        issue: "listDigestEntries/listDecisionCards/listQaSessions 仅定义，未发现任何调用方"
      - path: "src/features/chat/stores/digestStore.ts"
        issue: "只保存 digest entries，没有初始化回读"
      - path: "src/features/chat/stores/decisionStore.ts"
        issue: "只保存/更新 decision，没有初始化回读"
      - path: "src/features/chat/services/crossSessionQa.ts"
        issue: "只保存 QA session，没有历史加载链路"
    missing:
      - "在 digest/decision/qa store 初始化时从 knowledgeDb 回读历史数据"
      - "在 Knowledge 面板打开时触发回读并渲染已保存内容"
  - truth: "用户回归后能看到离线窗口内的精简 digest 列表。"
    status: failed
    reason: "digest 构建函数存在，但没有订阅真实 Matrix 消息流，也没有任何运行时代码调用 buildDigestSession。"
    artifacts:
      - path: "src/features/chat/stores/digestStore.ts"
        issue: "ingestEvent/buildDigestSession 仅在 store 内定义，代码库未发现调用方"
      - path: "src/matrix/digest.ts"
        issue: "仅 materialize 传入数组，未接入真实 room.message / offline-window 数据"
    missing:
      - "把离线窗口内的真实消息事件接入 digestStore.ingestEvent"
      - "在用户回归或打开 Knowledge 面板时调用 buildDigestSession"
  - truth: "digest 条目可按 responsibility/follow/mention 相关性排序。"
    status: failed
    reason: "排序函数存在，但 responsibility/follow/mention 信号没有从 rooms/user context 计算，当前只能依赖外部手工传入 relevanceHint。"
    artifacts:
      - path: "src/features/chat/stores/digestStore.ts"
        issue: "未接入 getRoomSummaries/isPinned/highlight 等真实相关性来源"
      - path: "src/features/chat/types/digest.ts"
        issue: "toDigestEntry 直接使用 event.relevanceHint，缺省降级为 mention"
    missing:
      - "从 pinned/favourite rooms、mention/highlight 或 owner 信号计算 relevance"
      - "把 follow 临时映射真正接入 digest materialization 流程"
  - truth: "用户可创建包含结论、背景、owner、状态、关联消息的决策卡，并从 linked messages 回跳验证上下文。"
    status: failed
    reason: "决策卡创建已实现，但 DecisionPanel 没有渲染 linked messages/citations，也没有回跳源消息的导航链路。"
    artifacts:
      - path: "src/features/chat/components/DecisionPanel.vue"
        issue: "只收集 roomId/eventId 并保存，无 linked-message 列表、无 openLinkedMessage"
      - path: "src/features/chat/stores/decisionStore.ts"
        issue: "仅处理创建和 disposition 更新，未支撑 linked-message UI 行为"
    missing:
      - "在 DecisionPanel 渲染 decision citations/linked messages"
      - "复用 loadInboxEventContext + focusEventId 实现 linked-message 回跳"
  - truth: "系统可从 digest/summary 中产出 AI 建议行动项/阻塞项，并以 pending 状态展示给用户，随后支持 accept/reject。"
    status: failed
    reason: "accept/reject 审计链路存在，但摘要提取链路不存在：计划中的 suggestionExtraction 服务文件缺失，store 也没有 digest/summary -> suggestion 提取流程。"
    artifacts:
      - path: "src/features/chat/services/suggestionExtraction.ts"
        issue: "计划中的提取服务文件不存在"
      - path: "src/features/chat/stores/decisionStore.ts"
        issue: "只能处理已传入的 suggestions，未从 digest/summary 生成 pending suggestions"
    missing:
      - "实现 extractSuggestionsFromSummary 合同"
      - "在 decisionStore 中消费 digest/summary 并持久化 pending suggestions"
      - "在 DecisionPanel 中展示 extracted suggestions 的来源与处置结果"
---

# Phase 4: Offline Digest and Decision Capture Verification Report

**Phase Goal:** 用户可以在离线回归时快速理解关键信息，并把讨论结论沉淀为可追溯知识资产。  
**Verified:** 2026-03-06T09:05:28Z  
**Status:** gaps_found  
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | digest / decision / qa 共享一致的 citation-first 领域合同。 | ✓ VERIFIED | `src/features/chat/types/knowledge.ts:16-80` 统一定义 `CitationRef`、`DigestEntry`、`DecisionCard`、`CrossSessionQaAnswer` 与 disposition 枚举。 |
| 2 | 用户重新打开 Knowledge 面板时，可以读回之前保存的知识内容。 | ✗ FAILED | `src/shared/lib/knowledgeDb.ts:78-91` 虽定义 `listDigestEntries/listDecisionCards/listQaSessions`，但 `src/features/chat/**` 下未发现任何调用；`digestStore.ts:43-64`、`decisionStore.ts:21-36`、`crossSessionQa.ts:23-34` 都只有保存动作。 |
| 3 | 系统存在统一的 Knowledge 面板壳层，并接入现有 side-panel。 | ✓ VERIFIED | `src/features/chat/components/KnowledgeCapturePanel.vue:23-104` 提供 digest / decision / qa tab；`src/features/chat/stores/chatStore.ts:42-58`、`src/features/chat/components/ChatWindow.vue:51-84`、`src/features/server/components/ChannelSidebar.vue:99-100,177-185` 已完成侧栏接线。 |
| 4 | 用户回归后能看到基于真实离线窗口生成的 digest。 | ✗ FAILED | `src/features/chat/stores/digestStore.ts:35-40,43-80` 只有 `ingestEvent/buildDigestSession`；全仓库对 `buildDigestSession(` 的搜索仅命中 store 自身，没有运行时接线。 |
| 5 | digest 条目支持 citation 回跳源消息。 | ✓ VERIFIED | `src/features/chat/components/OfflineDigestPanel.vue:20-34,74-84` 复用 `loadInboxEventContext + focusEventId`；`tests/components/OfflineDigestPanel.test.ts:68-113` 覆盖 preload 成功/失败降级导航。 |
| 6 | digest 相关性来自 responsibility / follow / mention 的真实用户信号。 | ✗ FAILED | `src/features/chat/types/digest.ts:37-49` 直接吃 `event.relevanceHint`，默认降级成 `mention`；`src/features/chat/stores/digestStore.ts` 未接入 `getRoomSummaries` / `isPinned` / highlight 数据。 |
| 7 | 用户可创建决策卡，并从 linked messages 回跳验证上下文。 | ✗ FAILED | `src/features/chat/components/DecisionPanel.vue:16-33,44-95` 只能保存单个 citation；文件内没有 `loadInboxEventContext` 调用，也没有 linked-message 列表渲染。 |
| 8 | 系统会从 digest/summary 生成 AI 建议，并支持带审计的 accept/reject。 | ✗ FAILED | `src/features/chat/services/suggestionExtraction.ts` 缺失；`src/features/chat/stores/decisionStore.ts:21-52` 仅支持对已存在 suggestions 做 disposition 更新，没有摘要提取流程。 |
| 9 | 用户可以提出跨会话问题并获得带 citations 的回答，且证据范围受 joined-room 限制。 | ✓ VERIFIED | `src/features/chat/services/crossSessionQa.ts:7-34` 调用 `searchRoomEvents` 生成 cited answer；`src/matrix/retrieval.ts:39-60` 仅以 joined rooms 作为搜索范围；`src/features/chat/components/CrossSessionQaPanel.vue:17-45,67-85` 支持提问与 citation 回跳。 |

**Score:** 4/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/features/chat/types/knowledge.ts` | Shared citation/domain contracts | ✓ VERIFIED | 存在且 substantive，定义完整 schema 与共享类型。 |
| `src/shared/lib/knowledgeDb.ts` | Indexed Dexie persistence | ⚠️ ORPHANED | `version(1).stores(...)` 已建立，但回读 API 未被实际知识流调用。 |
| `src/features/chat/components/KnowledgeCapturePanel.vue` | Single knowledge shell | ✓ VERIFIED | 壳层与三个子视图都已存在并接入 side-panel。 |
| `tests/components/KnowledgeCapturePanel.test.ts` | Shell contract coverage | ✗ MISSING | 计划中声明的文件不存在；仓库中只有 `tests/components/KnowledgeCapturePanel.integration.test.ts`。 |
| `src/matrix/digest.ts` | Offline digest materializer | ⚠️ ORPHANED | 物化函数存在，但未接入真实 Matrix 事件源。 |
| `src/features/chat/stores/digestStore.ts` | Away-window digest session + persistence | ⚠️ ORPHANED | store 逻辑存在，但无运行时调用方触发 `ingestEvent/buildDigestSession`。 |
| `src/features/chat/components/OfflineDigestPanel.vue` | Digest UI + citation jump | ✓ VERIFIED | 面板渲染与 citation 跳转链路存在。 |
| `src/features/chat/stores/decisionStore.ts` | Decision CRUD + disposition transitions | ⚠️ ORPHANED | 创建/accept/reject 存在，但没有 digest/summary 提取与回读初始化。 |
| `src/features/chat/components/DecisionPanel.vue` | Decision UI + linked-message jump | ✗ STUB | 可创建卡片和处置 suggestion，但缺少 linked messages 渲染与跳转。 |
| `src/features/chat/services/suggestionExtraction.ts` | Summary-to-suggestion extraction contract | ✗ MISSING | 计划声明文件不存在。 |
| `src/features/chat/services/crossSessionQa.ts` | Joined-room scoped QA service | ✓ VERIFIED | 服务存在且接入 retrieval + persistence。 |
| `src/features/chat/components/CrossSessionQaPanel.vue` | QA UI + cited answer jump | ✓ VERIFIED | UI 与 citation 跳转链路齐全。 |
| `src/features/chat/stores/chatStore.ts` / `ChatWindow.vue` / `ChannelSidebar.vue` | Unified knowledge entry wiring | ✓ VERIFIED | `knowledge` side-panel 状态、挂载点和入口按钮均已接线。 |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `src/shared/lib/knowledgeDb.ts` | Dexie | versioned indexed schema | ✓ WIRED | `knowledgeDb.ts:16-30` 定义了 `digestEntries/decisions/qaSessions` 索引。 |
| `src/features/chat/components/KnowledgeCapturePanel.vue` | `OfflineDigestPanel/DecisionPanel/CrossSessionQaPanel` | tabbed panel integration | ✓ WIRED | `KnowledgeCapturePanel.vue:69-104` 根据 `activeTab` 条件挂载 3 个子面板。 |
| `src/features/server/components/ChannelSidebar.vue` | `src/features/chat/stores/chatStore.ts` | single side-panel toggle for knowledge | ✓ WIRED | `ChannelSidebar.vue:99-100,177-185` 调用 `toggleSidePanel('knowledge')`；`chatStore.ts:48-55` 接收该状态。 |
| `src/features/chat/components/ChatWindow.vue` | `src/features/chat/components/KnowledgeCapturePanel.vue` | existing side panel mount | ✓ WIRED | `ChatWindow.vue:82` 在既有 side-panel 槽位挂载 `KnowledgeCapturePanel`。 |
| `src/features/chat/stores/digestStore.ts` | `src/matrix/digest.ts` | event materialization pipeline | ✓ WIRED | `digestStore.ts:54-58` 调用 `materializeOfflineDigest(...)`。 |
| `src/features/chat/stores/digestStore.ts` | `src/shared/lib/knowledgeDb.ts` | digest snapshot persistence | ✓ WIRED | `digestStore.ts:63` 持久化 `saveDigestEntry`。 |
| `src/features/chat/stores/digestStore.ts` | `src/matrix/rooms.ts` | pinned/favourite follow mapping | ✗ NOT_WIRED | `digestStore.ts` 中未发现 `getRoomSummaries` / `isPinned` 调用。 |
| `src/features/chat/components/OfflineDigestPanel.vue` | `@matrix/index` | citation preload + focusEventId navigation | ✓ WIRED | `OfflineDigestPanel.vue:20-34` 先 preload 再 `router.push({ focusEventId })`。 |
| `src/features/chat/components/DecisionPanel.vue` | `src/features/chat/stores/decisionStore.ts` | create/update and suggestion disposition | ✓ WIRED | `DecisionPanel.vue:16-33` 调用 `createDecisionCard` 与 `setSuggestionDisposition`。 |
| `src/features/chat/components/DecisionPanel.vue` | `src/matrix/inbox.ts` | linked message preload + focus navigation | ✗ NOT_WIRED | 文件内未发现 `loadInboxEventContext` 调用。 |
| `src/features/chat/stores/decisionStore.ts` | `src/shared/lib/knowledgeDb.ts` | decision persistence + suggestion updates | ✓ WIRED | `decisionStore.ts:21-24,36-36` 调用 `saveDecisionCard` / `updateSuggestionDisposition`。 |
| `src/features/chat/stores/decisionStore.ts` | `src/features/chat/services/suggestionExtraction.ts` | summary-to-suggestion extraction pipeline | ✗ NOT_WIRED | 缺少 `suggestionExtraction.ts` 文件，也无调用点。 |
| `src/features/chat/services/crossSessionQa.ts` | `src/matrix/retrieval.ts` | joined-room bounded evidence retrieval | ✓ WIRED | `crossSessionQa.ts:12` 调用 `searchRoomEvents`；`retrieval.ts:39-60` 只搜索 joined rooms。 |
| `src/features/chat/components/CrossSessionQaPanel.vue` | `@matrix/index` | citation preload + focus navigation | ✓ WIRED | `CrossSessionQaPanel.vue:31-45` 复用 preload + fallback 导航链路。 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| `DIGE-01` | `04-01`, `04-02`, `04-05` | User can view an offline catch-up digest for activity during their away window. | ✗ BLOCKED | `digestStore.ts:43-80` 仅提供手动 build API；全仓库没有运行时调用 `buildDigestSession`，也没有消息流接入 `ingestEvent`。 |
| `DIGE-02` | `04-01`, `04-02`, `04-05` | User can open source citations from digest entries to verify each summary claim. | ✗ BLOCKED | `OfflineDigestPanel.vue:20-34` 的 citation jump 已实现，但 `DIGE-01` 主链路未接线，真实用户拿不到 digest entries。 |
| `DIGE-03` | `04-01`, `04-02`, `04-05` | User can sort digest focus by personal relevance (my responsibility, my follows, my mentions). | ✗ BLOCKED | `types/digest.ts:44` 依赖外部 `relevanceHint`；`digestStore.ts` 未接入 pinned/favourite / mention/highlight 等用户信号。 |
| `DECI-01` | `04-01`, `04-03`, `04-05` | User can create a decision card with conclusion, context, owner, status, and linked messages. | ✗ BLOCKED | `decisionStore.ts:21-26` 能创建卡片，但 `DecisionPanel.vue` 未渲染 linked messages，也无 linked-message jump。 |
| `DECI-02` | `04-01`, `04-03`, `04-05` | User can accept or reject AI-suggested action items and blockers extracted from summaries. | ✗ BLOCKED | disposition 审计存在（`decisionStore.ts:28-52`），但 `suggestionExtraction.ts` 缺失，且没有 digest/summary -> pending suggestions 的生成链路。 |
| `DECI-03` | `04-01`, `04-04`, `04-05` | User can ask a cross-conversation question and receive an answer with traceable citations. | ✓ SATISFIED | `crossSessionQa.ts:7-34` + `retrieval.ts:39-60` + `CrossSessionQaPanel.vue:17-45,67-85` 完成问答、joined-room 约束与 citation 回跳。 |

Orphaned requirement IDs for Phase 4 in `REQUIREMENTS.md`: **None**. 计划 frontmatter 中声明的 `DIGE-01`, `DIGE-02`, `DIGE-03`, `DECI-01`, `DECI-02`, `DECI-03` 已全部在本报告中逐项核对。

### Automated Verification

- ✅ Focused Phase 4 tests 通过：
  - `pnpm vitest run tests/unit/stores/knowledgeDb.test.ts tests/unit/stores/digestStore.test.ts tests/unit/stores/decisionStore.test.ts tests/unit/services/crossSessionQa.test.ts tests/components/OfflineDigestPanel.test.ts tests/components/DecisionPanel.test.ts tests/components/CrossSessionQaPanel.test.ts tests/components/KnowledgeCapturePanel.integration.test.ts`
  - 结果：`8 passed, 22 passed`。
- ⚠️ 全量测试仍失败（与 Phase 4 现有缺口无直接对应）：
  - `pnpm test:unit`
  - 结果：`1 failed, 24 passed`；失败文件为 `tests/components/MessageBubble.test.ts`，报错来自 `lottie-web` 在 jsdom 下访问 canvas（`TypeError: Cannot set properties of null (setting 'fillStyle')`）。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `src/features/chat/services/suggestionExtraction.ts` | — | Planned artifact missing | 🛑 Blocker | DECI-02 的“从摘要提取 AI suggestions”主链路不存在。 |
| `src/features/chat/stores/digestStore.ts` | 35-40, 43-80 | Runtime-orphaned store API | 🛑 Blocker | DIGE-01 只能在测试里手动喂数据，真实用户回归看不到 digest。 |
| `src/features/chat/components/DecisionPanel.vue` | 16-33, 57-95 | Missing linked-message rendering/jump | 🛑 Blocker | DECI-01 的“linked messages 可追溯”未完成。 |
| `tests/components/KnowledgeCapturePanel.test.ts` | — | Planned test artifact missing | ⚠️ Warning | 有替代的 integration test，但与 must_haves 的声明路径不一致。 |
| `src/features/chat/components/OfflineDigestPanel.vue` | 25 | `console.warn` on preload fallback | ℹ️ Info | 降级导航策略，与全局搜索/任务回跳模式一致。 |
| `src/features/chat/components/CrossSessionQaPanel.vue` | 36 | `console.warn` on preload fallback | ℹ️ Info | 仅记录 preload 降级，不阻断导航。 |

### Gaps Summary

Phase 4 并未真正达到“离线回归可快速理解关键信息，并把讨论结论沉淀为可追溯知识资产”的目标。当前代码更接近“若手工喂入数据，则部分 UI/单测可运行”的状态，核心缺口有五类：

1. **知识资产只写不读**：仓储有 list API，但知识面板重新打开后不会恢复历史数据。
2. **digest 未接入真实运行态**：没有消息流订阅、没有离线窗口触发点、没有自动 build。
3. **digest relevance 仍是手工 hint**：缺少 pinned/favourite、mention/highlight 等真实用户信号映射。
4. **decision 可建不可追溯**：没有 linked messages 展示与跳转，用户无法回看决策依据。
5. **AI suggestion 提取主链路缺失**：accept/reject 有了，但“从摘要产出建议”这一前半段不存在。

在这些缺口修复前，`DIGE-01/02/03`、`DECI-01/02` 不能视为达成；当前仅 `DECI-03` 与统一 Knowledge 入口壳层达到验证标准。

---

_Verified: 2026-03-06T09:05:28Z_  
_Verifier: Claude (gsd-verifier)_
