---
phase: 04-offline-digest-and-decision-capture
verified: 2026-03-06T09:50:55Z
status: gaps_found
score: 7/9 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 4/9
  gaps_closed:
    - "digest 条目可按 responsibility/follow/mention 相关性排序。"
    - "用户可创建包含结论、背景、owner、状态、关联消息的决策卡，并从 linked messages 回跳验证上下文。"
    - "系统可从 digest/summary 中产出 AI 建议行动项/阻塞项，并以 pending 状态展示给用户，随后支持 accept/reject。"
  gaps_remaining:
    - "用户重新打开离线知识面板时，可以稳定读取已保存的知识条目而不丢失历史内容。"
    - "用户回归后能看到离线窗口内的精简 digest 列表。"
  regressions: []
gaps:
  - truth: "用户重新打开离线知识面板时，可以稳定读取已保存的知识条目而不丢失历史内容。"
    status: failed
    reason: "decision / qa 已补齐回读，但 digest 初始化会在回读后立刻用当前内存 sourceEvents 重建 session；当没有新事件时，已恢复的 digest 会被空数组覆盖。"
    artifacts:
      - path: "src/features/chat/stores/digestStore.ts"
        issue: "initializeDigest() 先 hydrateDigestEntries()，随后在 lastOfflineAt 存在时无条件 buildDigestSession()；buildDigestSession() 会把 entries.value 改写为 nextSession.entries，即使 sourceEvents 为空。"
      - path: "src/features/chat/components/OfflineDigestPanel.vue"
        issue: "面板挂载时直接调用 initializeDigest()，会触发上述覆盖路径。"
    missing:
      - "让 digest 回读结果在没有新离线窗口数据时保持可见，而不是被空 session 覆盖"
      - "只在确有 away-window source events 时刷新 digest，或把历史结果与新 session 合并显示"
  - truth: "用户回归后能看到离线窗口内的精简 digest 列表。"
    status: failed
    reason: "digest 仍只在面板打开后开始监听 room.message；没有任何代码在构建摘要前回扫 lastOfflineAt 以来已同步到本地的消息，因此已发生的离线窗口消息不会稳定进入 digest。"
    artifacts:
      - path: "src/features/chat/stores/digestStore.ts"
        issue: "startRuntimeSync() 仅注册 matrixEvents.on('room.message')，没有历史消息回填/时间窗扫描逻辑。"
      - path: "src/matrix/events.ts"
        issue: "room.message 事件由 Room.timeline 即时发射；若 digest store 在消息回补后才启动，则之前事件不会自动重放。"
    missing:
      - "在 digest 初始化时按 lastOfflineAt 扫描已同步房间时间线或等价离线窗口数据源"
      - "把回补得到的真实 away-window 消息转换为 DigestSourceEvent 再构建 session"
---

# Phase 4: Offline Digest and Decision Capture Verification Report

**Phase Goal:** 用户可以在离线回归时快速理解关键信息，并把讨论结论沉淀为可追溯知识资产。  
**Verified:** 2026-03-06T09:50:55Z  
**Status:** gaps_found  
**Re-verification:** Yes — after gap closure

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | digest / decision / qa 共享一致的 citation-first 领域合同。 | ✓ VERIFIED | `src/features/chat/types/knowledge.ts:3-80` 继续统一定义 `DigestEntry`、`DecisionCard`、`CrossSessionQaAnswer`、`CitationRef` 与 disposition schema。 |
| 2 | 用户重新打开离线知识面板时，可以稳定读取已保存的知识条目而不丢失历史内容。 | ✗ FAILED | `src/features/chat/stores/decisionStore.ts:76-83` 与 `src/features/chat/stores/qaStore.ts:27-36` 已能回读；但 `src/features/chat/stores/digestStore.ts:91-123` 会在 hydrate 后立刻重建 digest，并在 `sourceEvents` 为空时把已恢复的 `entries` 覆盖成空数组。 |
| 3 | 系统存在统一的 Knowledge 面板壳层，并接入现有 side-panel。 | ✓ VERIFIED | `src/features/chat/components/KnowledgeCapturePanel.vue:23-104`、`src/features/chat/stores/chatStore.ts:42-55`、`src/features/chat/components/ChatWindow.vue:51-84`、`src/features/server/components/ChannelSidebar.vue:95-101,177-186` 仍保持单入口接线。 |
| 4 | 用户回归后能看到基于真实离线窗口生成的 digest。 | ✗ FAILED | `src/features/chat/stores/digestStore.ts:58-80` 仅在面板初始化后注册 `matrixEvents.on('room.message')`；全仓库对 `useDigestStore()` 的唯一运行时使用点是 `src/features/chat/components/OfflineDigestPanel.vue:9-25`。未发现按 `lastOfflineAt` 回扫已同步消息的逻辑。 |
| 5 | digest 条目支持 citation 回跳源消息。 | ✓ VERIFIED | `src/features/chat/components/OfflineDigestPanel.vue:28-42` 继续复用 `loadInboxEventContext + focusEventId`；`tests/components/OfflineDigestPanel.test.ts` 新鲜通过。 |
| 6 | digest 相关性来自 responsibility / follow / mention 的真实用户信号。 | ✓ VERIFIED | `src/matrix/digest.ts:13-27` 调用 `getRoomSummaries()` 与 `getClient().getUserId()`；`src/features/chat/types/digest.ts:51-68` 以 `highlightCount` / mention heuristic 推导 `responsibility`，以 `isPinned` 推导 `follow`。 |
| 7 | 用户可创建决策卡，并从 linked messages 回跳验证上下文。 | ✓ VERIFIED | `src/features/chat/components/DecisionPanel.vue:19-56,97-135` 挂载时 `hydrateCards()`，渲染 linked messages，并通过 `openLinkedMessage()` 复用 preload + focus 跳转。 |
| 8 | 系统会从 digest/summary 生成 AI 建议，并支持带审计的 accept/reject。 | ✓ VERIFIED | `src/features/chat/services/suggestionExtraction.ts:4-30` 已实现提取合同；`src/features/chat/stores/decisionStore.ts:40-118` 物化 digest-backed suggestions、保留 disposition 审计；`tests/unit/services/suggestionExtraction.test.ts` 与 `tests/unit/stores/decisionStore.test.ts` 新鲜通过。 |
| 9 | 用户可以提出跨会话问题并获得带 citations 的回答，且证据范围受 joined-room 限制。 | ✓ VERIFIED | `src/features/chat/stores/qaStore.ts:27-36` 支持历史恢复；`src/features/chat/services/crossSessionQa.ts:7-40` 继续通过 `searchRoomEvents()` 检索；`src/matrix/retrieval.ts:39-60` 仍限定 joined rooms。 |

**Score:** 7/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/features/chat/types/knowledge.ts` | Shared citation/domain contracts | ✓ VERIFIED | 共享 schema 与类型合同完整存在。 |
| `src/shared/lib/knowledgeDb.ts` | Knowledge persistence read/write surface | ✓ VERIFIED | `listDigestEntries/listDecisionCards/listQaSessions` 与保存/更新 API 都存在，且已有调用方。 |
| `src/features/chat/stores/digestStore.ts` | Digest hydration + away-window orchestration | ✗ PARTIAL | 新增 hydrate/runtime sync，但会覆盖已恢复 digest，且缺少 `lastOfflineAt` 历史回扫。 |
| `src/matrix/digest.ts` | Real-signal digest materializer | ✓ VERIFIED | 真实 room/user 信号接入完成。 |
| `src/features/chat/components/OfflineDigestPanel.vue` | Digest UI + citation jump | ✓ VERIFIED | 挂载初始化与 citation jump 存在。 |
| `src/features/chat/services/suggestionExtraction.ts` | Summary-to-suggestion extraction | ✓ VERIFIED | 文件已存在，导出 `extractSuggestionsFromSummary()`。 |
| `src/features/chat/stores/decisionStore.ts` | Decision hydration + suggestion materialization | ✓ VERIFIED | 历史卡片恢复、digest-backed suggestions 物化、审计保留均存在。 |
| `src/features/chat/components/DecisionPanel.vue` | Decision UI + linked-message jump | ✓ VERIFIED | linked messages / suggestions UI 和跳转链路齐全。 |
| `src/features/chat/stores/qaStore.ts` | QA history hydration | ✓ VERIFIED | `hydrateHistory()` / `askQuestion()` 已接通。 |
| `src/features/chat/services/crossSessionQa.ts` | QA ask + history listing service | ✓ VERIFIED | `askCrossSessionQuestion()` 与 `listSavedQaSessions()` 均存在。 |
| `src/features/chat/components/CrossSessionQaPanel.vue` | QA UI + history restore + citation jump | ✓ VERIFIED | 面板挂载恢复历史，支持 citation 回跳。 |
| `src/features/chat/components/KnowledgeCapturePanel.vue` / `chatStore.ts` / `ChatWindow.vue` / `ChannelSidebar.vue` | Unified knowledge entry wiring | ✓ VERIFIED | 统一侧栏入口与挂载点未回归。 |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `src/features/chat/stores/digestStore.ts` | `src/shared/lib/knowledgeDb.ts` | `listDigestEntries + saveDigestEntry` | ⚠️ PARTIAL | 读写链路存在（`digestStore.ts:51-56,122-123`），但初始化后会被空 session 覆盖。 |
| `src/features/chat/stores/digestStore.ts` | `src/matrix/events.ts` | `room.message` runtime listener | ⚠️ PARTIAL | `digestStore.ts:58-80` 已监听实时事件，但没有历史回填，不能稳定覆盖离线窗口。 |
| `src/matrix/digest.ts` | `src/matrix/rooms.ts` | room summary relevance mapping | ✓ WIRED | `matrix/digest.ts:13-23` 使用 `getRoomSummaries()`；`types/digest.ts:61-65` 使用 `highlightCount` / `isPinned`。 |
| `src/features/chat/components/OfflineDigestPanel.vue` | `src/matrix/inbox.ts` | citation preload and focus navigation | ✓ WIRED | `OfflineDigestPanel.vue:28-42` 正确 preload 后导航。 |
| `src/features/chat/stores/decisionStore.ts` | `src/shared/lib/knowledgeDb.ts` | `listDecisionCards + listDigestEntries + saveDecisionCard` | ✓ WIRED | `decisionStore.ts:71,76-83,88,101` 全链路存在。 |
| `src/features/chat/stores/decisionStore.ts` | `src/features/chat/services/suggestionExtraction.ts` | digest summary extraction pipeline | ✓ WIRED | `decisionStore.ts:4,40-43` 已直接调用提取服务。 |
| `src/features/chat/components/DecisionPanel.vue` | `src/matrix/inbox.ts` | linked-message preload and focus navigation | ✓ WIRED | `DecisionPanel.vue:42-56,101-107` 已接线。 |
| `src/features/chat/stores/qaStore.ts` | `src/features/chat/services/crossSessionQa.ts` | hydrate + ask orchestration | ✓ WIRED | `qaStore.ts:3,27-36` 已通过 service 协调。 |
| `src/features/chat/services/crossSessionQa.ts` | `src/shared/lib/knowledgeDb.ts` | `saveQaSession + listQaSessions` | ✓ WIRED | `crossSessionQa.ts:33,37-39` 已接线。 |
| `src/features/chat/components/CrossSessionQaPanel.vue` | `src/matrix/inbox.ts` | citation preload and focus navigation | ✓ WIRED | `CrossSessionQaPanel.vue:41-55` 已接线。 |
| `src/features/server/components/ChannelSidebar.vue` | `src/features/chat/stores/chatStore.ts` | single side-panel toggle for knowledge | ✓ WIRED | `ChannelSidebar.vue:99-101,177-186` 调用 `toggleSidePanel('knowledge')`。 |
| `src/features/chat/components/ChatWindow.vue` | `src/features/chat/components/KnowledgeCapturePanel.vue` | existing side panel mount | ✓ WIRED | `ChatWindow.vue:52-84` 在既有槽位挂载 Knowledge 面板。 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| `DIGE-01` | `04-01`, `04-02`, `04-05`, `04-06` | User can view an offline catch-up digest for activity during their away window. | ✗ BLOCKED | `src/features/chat/stores/digestStore.ts:58-80,91-123` 只在面板打开后监听新 `room.message`，且会在无新事件时清空已恢复 digest；未实现 `lastOfflineAt` 窗口的历史消息回填。 |
| `DIGE-02` | `04-01`, `04-02`, `04-05`, `04-06` | User can open source citations from digest entries to verify each summary claim. | ✗ BLOCKED | `src/features/chat/components/OfflineDigestPanel.vue:28-42` 的 citation jump 已实现，但 `DIGE-01` 主链路未稳定产出可见 digest，用户无法可靠地拿到需要验证的条目。 |
| `DIGE-03` | `04-01`, `04-02`, `04-05`, `04-06` | User can sort digest focus by personal relevance (my responsibility, my follows, my mentions). | ✓ SATISFIED | `src/matrix/digest.ts:13-27` + `src/features/chat/types/digest.ts:51-91` 已用真实 room/user 信号推导 relevance 并排序；`tests/unit/stores/digestStore.test.ts:141-162` 新鲜验证 `responsibility > follow > mention`。 |
| `DECI-01` | `04-01`, `04-03`, `04-05`, `04-07` | User can create a decision card with conclusion, context, owner, status, and linked messages. | ✓ SATISFIED | `src/features/chat/components/DecisionPanel.vue:23-31,97-111` 可创建并渲染 linked messages；`src/features/chat/stores/decisionStore.ts:86-90` 持久化卡片。 |
| `DECI-02` | `04-01`, `04-03`, `04-05`, `04-07` | User can accept or reject AI-suggested action items and blockers extracted from summaries. | ✓ SATISFIED | `src/features/chat/services/suggestionExtraction.ts:4-30` 实现提取；`src/features/chat/stores/decisionStore.ts:40-118` 物化并保留 disposition 审计；`src/features/chat/components/DecisionPanel.vue:113-135` 提供 accept/reject UI。 |
| `DECI-03` | `04-01`, `04-04`, `04-05`, `04-08` | User can ask a cross-conversation question and receive an answer with traceable citations. | ✓ SATISFIED | `src/features/chat/stores/qaStore.ts:27-36` + `src/features/chat/services/crossSessionQa.ts:7-40` + `src/features/chat/components/CrossSessionQaPanel.vue:18-55,81-123` 完成历史恢复、带 citation 的问答与回跳。 |

Orphaned requirement IDs for Phase 4 in `REQUIREMENTS.md`: **None**. 本 phase 所有在 PLAN frontmatter 中声明的 requirement IDs（`DIGE-01`, `DIGE-02`, `DIGE-03`, `DECI-01`, `DECI-02`, `DECI-03`）均已逐项核对；`REQUIREMENTS.md:71-76` 也没有额外未被计划声明的 Phase 4 requirement。

### Automated Verification

- ✅ 新鲜聚焦测试通过：
  - `pnpm vitest run tests/unit/stores/digestStore.test.ts tests/components/OfflineDigestPanel.test.ts tests/unit/services/suggestionExtraction.test.ts tests/unit/stores/decisionStore.test.ts tests/components/DecisionPanel.test.ts tests/unit/stores/qaStore.test.ts tests/unit/services/crossSessionQa.test.ts tests/components/CrossSessionQaPanel.test.ts tests/components/KnowledgeCapturePanel.integration.test.ts`
  - 结果：`9 passed`, `29 passed`。
- ⚠️ 但测试覆盖没有证明 digest 的两个关键场景：
  - “已保存 digest + 无新 sourceEvents 时 reopening 不会把历史清空”
  - “面板打开前已同步完成的 away-window 消息会被纳入 digest”

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `src/features/chat/stores/digestStore.ts` | 91-99, 102-123 | Hydrate-then-clobber restored state | 🛑 Blocker | 面板重开时，已恢复的 digest 可能立即被空 session 覆盖。 |
| `src/features/chat/stores/digestStore.ts` | 58-80 | Runtime-only listener without offline-window backfill | 🛑 Blocker | digest 只能依赖挂载后的新 `room.message`，无法稳定覆盖用户离线期间已同步的消息。 |
| Scoped Phase 4 files | — | `TODO/FIXME/XXX/HACK/PLACEHOLDER/console.log` markers | ✓ None | 对本次核验范围内的 Phase 4 关键实现文件执行 `rg`，未发现显式占位/调试残留。 |

### Gaps Summary

本次 gap closure 已显著推进 Phase 4：

1. **Decision 链路已闭环**：决策卡可恢复、linked messages 可回跳、digest-backed suggestions 可提取且保留 accept/reject 审计。
2. **QA 链路已闭环**：QA 子视图可恢复历史，新问答继续受 joined-room 检索边界约束并保留 citation 回跳。
3. **Digest relevance 规则已落地**：`responsibility/follow/mention` 不再依赖手工 hint。

但 **Phase Goal 仍未达成**，原因集中在 digest 主链路还差最后两步：

- **恢复后会丢历史**：已保存 digest 在 reopening 时会被空 session 覆盖。
- **没有离线窗口历史回填**：digest 仍未从 `lastOfflineAt` 对应的已同步消息中构建摘要，只监听面板打开后的新事件。

因此，用户仍不能稳定地“在离线回归时快速理解关键信息”；同时 `DIGE-01` 未达成也连带阻断了 `DIGE-02` 的真实可用性。Phase 4 现在更准确的状态是：**decision / qa 已达标，digest relevance 达标，但 digest 可见性与离线窗口构建仍未闭环。**

---

_Verified: 2026-03-06T09:50:55Z_  
_Verifier: Claude (gsd-verifier)_
