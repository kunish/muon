# Project Research Summary

**Project:** Muon
**Domain:** Matrix 桌面协作客户端（聊天效率与知识沉淀）
**Researched:** 2026-03-05
**Confidence:** MEDIUM-HIGH

## Executive Summary

这是一个 **brownfield 增量里程碑**：在已上线的 Matrix + Vue 3 + Tauri 聊天产品上，新增“高流量消息处理效率”与“可追溯知识沉淀”能力。综合四份研究，行业共识不是“再造一套新系统”，而是以 Matrix 事件为真值源，在本地建立可重建投影（inbox / task / retrieval / digest / decision），先打通“收件箱→任务→回链→检索→摘要/决策”闭环，再逐步引入更智能能力。

推荐路线非常明确：**v1 只引入一项核心基础设施变更——本地 SQLite + FTS5（通过 Tauri SQL 插件）**，其余最大化复用现有 chatStore、matrix event bus、路由与组件体系。功能上以 P1（统一收件箱、defer、消息转任务、带引用离线 digest）为上线范围；P2（语义问答、决策卡深化）在主链路指标通过后再扩。

核心风险也高度集中：回执语义错配导致 inbox 真相漂移、/sync gap 导致漏消息、任务幂等失效导致重复任务、检索 ACL 泄漏以及摘要无证据导致不可审计。缓解策略应前置到路线设计：先做事件摄取一致性与幂等约束，再做功能层；所有摘要/问答必须强制 citation，所有检索命中必须双层权限裁决。

## Key Findings

### Recommended Stack

v1 的关键决策是“**单库单索引**”：业务主数据与检索索引统一落本地 SQLite，全文检索用 FTS5，不引入向量库、外部搜索服务或工作流引擎。这样能以最小改造获得离线可用、可迁移、可审计能力，并避免 Dexie/SQLite 双写一致性风险。

**Core technologies:**
- `@tauri-apps/plugin-sql@^2.3.2`：前端访问本地 SQLite —— 官方 v2 插件，侵入最小，适配现有 Tauri 2.10。
- `tauri-plugin-sql@2.3.2 (sqlite)`：Rust 侧驱动与 migration 注册 —— 支持版本化 schema 演进。
- `SQLite 3.x + FTS5`：统一 inbox/task/decision/retrieval 存储与检索 —— 离线优先、可解释、成熟稳定。

关键版本约束：`tauri@2.10.0` ↔ `tauri-plugin-sql@2.3.2`，Rust 最低 `1.77.2+`。

### Expected Features

**Must have (table stakes, v1):**
- 统一收件箱（@提及/未读/回复 + 过滤 + 批量已读）。
- 稍后处理队列（保存、提醒、完成）。
- 消息转任务（责任人/截止时间/状态 + 回跳源消息）。
- 基础离线 digest（时间窗摘要 + 引用链接）。

**Should have (differentiators, v1.x):**
- 决策卡片（结论、背景、关联消息、owner、状态）作为高密度知识单元。
- 摘要自动提取行动项/阻塞项/待确认项（必须附证据）。
- 跨会话问答卡（可追溯引用）。

**Defer (v2+):**
- 外部 PM 工具全量双向同步（Jira/Asana/Linear）。
- 自动化决策抽取并自动发布（高治理风险）。

### Architecture Approach

架构主线是 **Matrix-first + Local Projection**：Matrix 继续作为事实源，本地存储只保留可重建投影；状态层采用“薄 chatStore + feature stores（inbox/task/retrieval/digest/decision）”；集成层通过 `matrixEfficiencyAdapter` 统一事件归一化，组件仅 dispatch，不直接碰 Matrix SDK 或 DB。

**Major components:**
1. `InboxPage + inboxStore/service` — 聚合 triage 入口与批处理动作。
2. `TaskPanel + taskStore/service` — message-to-task、状态流转与回链跳转。
3. `Retrieval/Digest/Decision` stores+services — 检索、离线回归摘要、决策沉淀与复用。

### Critical Pitfalls

1. **Inbox 真相漂移（receipt 语义错配）** — 按 `(user_id, receipt_type, thread_id?)` 幂等处理，建立 receipt 测试矩阵。
2. **/sync gap 未补齐导致漏消息** — 检测 `timeline.limited` 强制回填，回填前标记 `index_stale`。
3. **消息转任务非幂等导致重复任务** — 固定 idempotency key（`room:event:action`）+ 唯一约束映射表。
4. **检索 ACL 泄漏** — pre-filter ACL + 返回前二次权限校验，权限变更触发重索引。
5. **摘要不可审计/误导** — 固定摘要 schema，强制 source citation，无证据不入摘要。

## Implications for Roadmap

基于依赖关系与风险顺序，建议采用以下阶段结构：

### Phase 0: 事件摄取一致性基建
**Rationale:** 不先解决 /sync gap 与事件归一化，后续所有功能都会“看起来能跑、实则漏数”。
**Delivers:** `matrixEfficiencyAdapter`、效率域事件契约、gap recovery、基础可观测指标。
**Addresses:** 统一收件箱/检索/摘要的共同前置依赖。
**Avoids:** Pitfall #2（漏消息漏任务）。

### Phase 1: Unified Inbox MVP
**Rationale:** 最低风险、最高可见价值，且是 defer/task/digest 的入口依赖。
**Delivers:** mentions/unread/replied 聚合、过滤、批量已读、消息跳转上下文。
**Addresses:** P1「统一收件箱」。
**Avoids:** Pitfall #1（read/unread 漂移）。

### Phase 2: Defer + Message-to-Task 闭环
**Rationale:** 在 inbox 基础上构建“抓住→执行”主链路，直接验证里程碑核心价值。
**Delivers:** defer 队列、任务实体（assignee/due/status）、jump-back 回链。
**Uses:** SQLite schema/migrations、Tauri SQL 插件。
**Avoids:** Pitfall #3（重复任务）、#4（回链断裂）。

### Phase 3: Retrieval with ACL Guardrails
**Rationale:** digest 与 decision 都依赖检索；先把权限安全与索引可靠性做对。
**Delivers:** FTS5 检索、在线优先+离线回退、ACL 预过滤与结果复核。
**Implements:** retrievalStore/service + local index adapter。
**Avoids:** Pitfall #5（越权泄漏）、#6（受污染知识输入）。

### Phase 4: Offline Digest + Decision Capture
**Rationale:** 有了检索与任务回链后，摘要/决策才可追溯、可治理，而非“漂亮文本”。
**Delivers:** 带引用 digest、决策卡生命周期字段（owner/status/review/superseded）。
**Addresses:** P1 digest + P2 decision capture。
**Avoids:** Pitfall #7（摘要漏关键）、#8（决策墓地化）。

### Phase 5: 性能与运行稳定性加固
**Rationale:** 里程碑验收必须确保效率能力不伤害聊天主体验。
**Delivers:** 后台队列与 backpressure、性能预算与降级策略、稳定性基线。
**Avoids:** Pitfall #9（后台索引拖慢前台）。

### Phase Ordering Rationale

- 顺序遵循“**真值一致性 → 单入口处理 → 执行闭环 → 安全检索 → 知识产出 → 性能加固**”。
- 分组遵循架构边界：先 adapter/store 契约，再 UI 能力，再跨域能力（retrieval/digest/decision）。
- 通过前置幂等、ACL、citation 约束，避免后期返工为安全/可信度补洞。

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3（Retrieval + ACL）:** 涉及 Matrix 权限语义、history visibility、离房后可见性与索引重建策略，建议做 `/gsd-research-phase`。
- **Phase 4（Digest/Decision 质量门禁）:** 需要质量评估指标与人审门禁策略细化，建议做 `/gsd-research-phase`。

Phases with standard patterns (可跳过深度 research-phase):
- **Phase 1（Inbox MVP）:** 模式成熟，竞品与 Matrix 回执规范清晰。
- **Phase 2（Defer + Task）:** 以幂等键与回链模型为核心，工程路径明确。

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | 官方 Tauri/SQLite 文档与版本兼容信息充分，决策边界清晰。 |
| Features | MEDIUM | 竞品与用户预期证据充分，但部分 AI 能力价值假设仍需真实使用数据验证。 |
| Architecture | HIGH | 基于现有仓库结构与 Matrix 集成现状，改造路径具体且可执行。 |
| Pitfalls | MEDIUM-HIGH | Matrix 规范与 OWASP 支撑强，但 RAG 与摘要质量阈值需本项目实测标定。 |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **检索规模与索引策略阈值未量化：** 在 Phase 3 定义消息量分段（如 50k/200k）下的索引重建 SLA 与淘汰策略。
- **摘要质量发布门槛未数值化：** 在 Phase 4 明确 coverage/factual consistency/actionability 的通过阈值。
- **决策卡治理流程细则待定：** 需在产品流程中定义 review 频率、过期降权规则与变更通知机制。
- **web 预览降级策略验证不足：** `minisearch` 仅建议性方案，是否纳入里程碑需单独决策。

## Sources

### Primary (HIGH confidence)
- Matrix Client-Server API v1.17 — `/sync` gap、receipts、redaction/replacement、server-side search 语义。
- Tauri v2 SQL/Store/Notification docs — 插件能力、版本兼容、迁移与权限模型。
- SQLite FTS5 official docs — 全文检索机制与限制。
- Repository code audit（Muon）— 现有 stores/components/router/matrix 集成边界。

### Secondary (MEDIUM confidence)
- matrix-js-sdk API docs — `searchRoomEvents`、`setAccountData` 等工程集成接口。
- Slack/Teams/Discord/Asana/Confluence 官方文档与功能页 — 功能基线与竞品能力映射。
- OWASP GenAI Top 10 2025 — RAG 注入、敏感信息泄漏、向量弱点风险框架。
- sqlite-vec README — 向量方案 pre-v1 风险判断依据。

### Tertiary (LOW confidence)
- 无显著低置信单点来源；当前不依赖论坛/单博文结论做关键决策。

---
*Research completed: 2026-03-05*
*Ready for roadmap: yes*
