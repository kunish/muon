---
phase: 03-cross-conversation-retrieval
verified: 2026-03-06T04:21:17Z
status: human_needed
score: 6/6 must-haves verified
human_verification:
  - test: "真实 Matrix 权限边界检索"
    expected: "跨会话检索结果仅包含当前 membership=join 的会话消息，不出现 leave/invite 会话结果"
    why_human: "需要真实服务端授权与账号状态，静态代码与单测无法覆盖服务端实际可见性"
  - test: "结果回跳后的实际定位体验"
    expected: "点击检索结果后进入目标会话并高亮/定位到 focusEventId 对应消息"
    why_human: "涉及路由切换、时间线滚动与视觉定位体验，需在真实 UI 运行态确认"
---

# Phase 3: Cross-Conversation Retrieval Verification Report

**Phase Goal:** 用户可以跨会话快速找回相关消息，同时系统保证检索结果不越权。
**Verified:** 2026-03-06T04:21:17Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                  | Status     | Evidence                                                                                                                                                                                                               |
| --- | ------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 用户输入关键词后，系统会返回跨会话消息检索结果。       | ✓ VERIFIED | `src/matrix/retrieval.ts:54-57` 调用 `client.searchRoomEvents`；`src/features/chat/stores/retrievalStore.ts:42-46` 写入结果；`src/features/chat/components/GlobalSearch.vue:156-177` 渲染结果。                        |
| 2   | 检索结果只来自当前 membership 为 join 的会话。         | ✓ VERIFIED | 服务层过滤：`src/matrix/retrieval.ts:40-43`、`:59-60`、`:123-124`；UI 再过滤：`src/features/chat/components/GlobalSearch.vue:21-26`、`:39`；测试覆盖 left-room 排除：`tests/components/GlobalSearch.test.ts:121-138`。 |
| 3   | 检索支持分页续取，不会重复第一页结果。                 | ✓ VERIFIED | `src/matrix/retrieval.ts:79-110` 使用 `backPaginateRoomEventsSearch` + `seenEventIds` 去重；单测验证不重复并推进 token：`tests/unit/matrix/retrieval.test.ts:38-59`。                                                  |
| 4   | 用户可以在全局搜索入口输入关键词并看到跨会话消息结果。 | ✓ VERIFIED | `GlobalSearch` 表单提交触发 `retrievalStore.search`：`src/features/chat/components/GlobalSearch.vue:108-109,59-61`；组件测试：`tests/components/GlobalSearch.test.ts:96-119`。                                         |
| 5   | 用户点击某条结果后能回到对应会话并定位到目标消息。     | ✓ VERIFIED | 点击结果执行 `loadInboxEventContext` 后 `router.push({query:{focusEventId}})`：`src/features/chat/components/GlobalSearch.vue:67-85`；组件测试验证调用顺序与 query：`tests/components/GlobalSearch.test.ts:140-167`。  |
| 6   | UI 不会展示来自 left/invite 会话的检索结果。           | ✓ VERIFIED | `messageHits` 仅保留 joined rooms：`src/features/chat/components/GlobalSearch.vue:39`；测试验证 left-room 不渲染：`tests/components/GlobalSearch.test.ts:121-138`。                                                    |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact                                        | Expected                                                          | Status     | Details                                                                               |
| ----------------------------------------------- | ----------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `src/matrix/retrieval.ts`                       | Cross-conversation retrieval service with membership scoping      | ✓ VERIFIED | 文件存在（146 行），包含 `searchRoomEvents`、join 过滤、分页续取、去重逻辑。          |
| `tests/unit/matrix/retrieval.test.ts`           | Unit coverage for query transform, joined-room filter, pagination | ✓ VERIFIED | 文件存在（70 行），4 个用例覆盖关键词传递、joined-room 过滤、分页去重、空关键词短路。 |
| `tests/mocks/matrix-search.ts`                  | Deterministic Matrix search mock payloads                         | ✓ VERIFIED | 文件存在（87 行），包含 mixed membership 与 `next_batch` mock。                       |
| `src/matrix/index.ts`                           | Public export of retrieval service API                            | ✓ VERIFIED | `src/matrix/index.ts:36-37` 导出 retrieval API 与类型，已被 `retrievalStore` 使用。   |
| `src/features/chat/stores/retrievalStore.ts`    | Query/result/loading/pagination state for global retrieval        | ✓ VERIFIED | 文件存在（93 行），`search/loadMore` 实现并驱动 UI 状态。                             |
| `src/features/chat/components/GlobalSearch.vue` | Global retrieval UI with result sections and jump link            | ✓ VERIFIED | 文件存在（213 行），包含提交检索、结果渲染、load more、`focusEventId` 回跳链路。      |
| `tests/components/GlobalSearch.test.ts`         | Component coverage for render/exclude-left-room/jump behavior     | ✓ VERIFIED | 文件存在（198 行），覆盖渲染、越权过滤、回跳成功与降级路径。                          |

### Key Link Verification

| From                                            | To                                            | Via                                                      | Status  | Details                                                          |
| ----------------------------------------------- | --------------------------------------------- | -------------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| `src/matrix/retrieval.ts`                       | matrix-js-sdk `MatrixClient.searchRoomEvents` | keyword search request                                   | ✓ WIRED | `src/matrix/retrieval.ts:54-57` 真实调用 SDK 搜索接口。          |
| `src/matrix/retrieval.ts`                       | current joined rooms                          | `client.getRooms().filter(getMyMembership() === 'join')` | ✓ WIRED | `src/matrix/retrieval.ts:40-43` 构造 joined 房间范围。           |
| `src/matrix/retrieval.ts`                       | Matrix pagination                             | `backPaginateRoomEventsSearch`                           | ✓ WIRED | `src/matrix/retrieval.ts:91` 调用 SDK 分页；`:95-104` 去重追加。 |
| `src/features/chat/components/GlobalSearch.vue` | `src/features/chat/stores/retrievalStore.ts`  | search submit and result rendering                       | ✓ WIRED | `GlobalSearch.vue:4,19,59-65,156-177` 导入并调用 store。         |
| `src/features/chat/components/GlobalSearch.vue` | `src/matrix/inbox.ts`                         | preload context before route push                        | ✓ WIRED | `GlobalSearch.vue:3,67-70` 调用 `loadInboxEventContext`。        |
| `src/features/chat/components/GlobalSearch.vue` | router query                                  | focus event navigation                                   | ✓ WIRED | `GlobalSearch.vue:79-84` 路由 query 传递 `focusEventId`。        |

### Requirements Coverage

| Requirement | Source Plan  | Description                                                                                  | Status      | Evidence                                                                                                                                                                     |
| ----------- | ------------ | -------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RETR-01     | 03-01, 03-02 | User can search messages across conversations by keyword and receive ranked results.         | ✓ SATISFIED | 服务层跨会话检索 + 分页（`src/matrix/retrieval.ts:28-77,79-110`），UI 渲染与交互（`GlobalSearch.vue:108-109,156-177,193-201`），对应单测全通过。                             |
| RETR-02     | 03-01, 03-02 | User only sees retrieval results from conversations they are currently authorized to access. | ✓ SATISFIED | 服务层强制 joined-room 过滤（`retrieval.ts:40-43,59-60,123-124`），UI 层二次过滤（`GlobalSearch.vue:21-26,39`），排除 left-room 测试通过（`GlobalSearch.test.ts:121-138`）。 |

Orphaned requirement IDs for Phase 3 in `REQUIREMENTS.md`: **None** (仅 `RETR-01`, `RETR-02`，且均出现在 PLAN frontmatter)。

### Anti-Patterns Found

| File                                            | Line | Pattern                         | Severity | Impact                                                                      |
| ----------------------------------------------- | ---- | ------------------------------- | -------- | --------------------------------------------------------------------------- |
| `src/features/chat/components/GlobalSearch.vue` | 72   | `console.warn` in fallback path | ℹ️ Info  | 用于预加载失败降级提示，不阻断导航，符合计划中的“失败 warning 后继续跳转”。 |

### Human Verification Required

### 1. 真实 Matrix 权限边界检索

**Test:** 使用同时加入与退出多个会话的真实账号，执行同一关键词跨会话检索。
**Expected:** 仅返回当前 joined 会话消息，不出现 leave/invite 会话消息。
**Why human:** 需要真实 homeserver 的授权与索引行为，单测 mock 无法等价证明。

### 2. 回跳定位体验与可用性

**Test:** 在运行中的 UI 点击消息检索结果，观察是否平滑回跳并定位到目标消息。
**Expected:** 路由带 `focusEventId`，时间线正确聚焦目标消息，弹层关闭。
**Why human:** 涉及视觉定位与交互体验，静态检查无法评估“快速找回”的真实体验。

### Gaps Summary

自动化与静态验证未发现实现缺口：6/6 must-haves 已满足，相关单测（`tests/components/GlobalSearch.test.ts`、`tests/unit/matrix/retrieval.test.ts`）均通过。当前仅剩真实环境与体验层面的人工确认项，因此本次结论为 `human_needed`。

---

_Verified: 2026-03-06T04:21:17Z_
_Verifier: Claude (gsd-verifier)_
