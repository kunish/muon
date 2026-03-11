# Pitfalls Research

**Domain:** 在既有 Matrix 协作产品中叠加 chat-efficiency + knowledge-capture（统一收件箱、消息转任务、检索、离线摘要、决策沉淀）
**Researched:** 2026-03-05
**Confidence:** MEDIUM-HIGH

## Critical Pitfalls

### Pitfall 1: 统一收件箱“真相漂移”（Read/Unread 语义错配）

**What goes wrong:**
Inbox 待处理数量与用户体感不一致：有些消息明明“看过了”仍在待办；有些线程未读却被清空。

**Why it happens:**
把 `m.read`、`m.read.private`、threaded/unthreaded receipt 混为一个布尔状态；忽略 Matrix 里「按 `user_id + receipt_type + thread_id` 替换」和私有回执不可广播语义。

**How to avoid:**

1. 定义统一 inbox 状态机（explicit schema）：`unread / seen / deferred / done`，并单独存储 receipt 视图。
2. 回执处理按 `(user_id, receipt_type, thread_id?)` 做幂等替换，不做“最后写覆盖全部线程”。
3. 私有回执只影响本人通知与 inbox，不影响团队可见 read 状态。
4. 加 12+ 条回归用例：主时间线、线程、private/public receipt 交叉组合。

**Warning signs:**

- 相同用户在不同设备看到不同待处理数
- “标为已读”后通知消失但 inbox 仍残留
- 线程展开后待处理数突变

**Phase to address:**
**Phase 1（Inbox 语义层）**

---

### Pitfall 2: /sync gap 未补齐导致“漏消息漏任务”

**What goes wrong:**
高流量房间中 inbox 漏项、消息转任务漏触发，用户回到桌面后发现关键消息“从未进入系统”。

**Why it happens:**
只消费 `/sync` 增量，不处理 `limited` timeline 与 `prev_batch/next_batch` 形成的 gap；未用 `/rooms/{roomId}/messages` 回填。

**How to avoid:**

1. 将 “gap recovery” 作为 ingest pipeline 的强制步骤：检测 `timeline.limited=true` 即触发回填任务。
2. 回填完成前把受影响房间标记为 `index_stale`，暂停其摘要/决策自动生成。
3. 指标化：`sync_gap_count`, `gap_recovery_latency_p95`, `unindexed_event_age`。
4. 故障演练：模拟离线 2h/24h 回来后的补齐一致性。

**Warning signs:**

- 同一 room 的事件 ID 序列出现不可解释断层
- 摘要引用了不存在于本地索引的消息
- 重连后任务增量明显低于消息增量

**Phase to address:**
**Phase 0（事件摄取与一致性基建）**

---

### Pitfall 3: 消息转任务重复创建（非幂等集成）

**What goes wrong:**
一次“转任务”操作生成多条重复任务，或重试后产生分叉任务，破坏信任。

**Why it happens:**
网络抖动 + 重试策略下没有稳定幂等键；仅凭“标题相似”去重。

**How to avoid:**

1. 采用稳定 idempotency key：`{room_id}:{event_id}:{action_type}`。
2. 写入前先查“外部任务ID映射表”（unique constraint）。
3. 转任务 API 失败重试必须是 same key replay，不允许重新生成 key。
4. 回归测试：超时/429/500 场景下重复点击仍只生成 1 条。

**Warning signs:**

- 同一源消息对应多个任务 ID
- 任务系统出现短时间高相似标题 burst
- 用户手动合并任务次数持续上升

**Phase to address:**
**Phase 2（Message→Task 集成）**

---

### Pitfall 4: 回链断裂（编辑/撤回/重定向后无法跳回上下文）

**What goes wrong:**
任务卡片“跳转原消息”404 或跳到错误版本；决策卡引用内容与当前可见内容不一致。

**Why it happens:**
未处理 Matrix `m.replace`（编辑聚合）与 `redaction`（内容剥离）语义；只存文本快照不存稳定事件引用。

**How to avoid:**

1. 数据模型必须双写：`source_event_id + source_room_id + captured_snapshot`。
2. 打开任务时动态解析“当前可见版本”（考虑最新有效 edit + redaction）。
3. 对 redacted 原消息显示“内容已撤回”占位，不静默失败。
4. 建立 nightly link integrity job：抽样验证回链可解析率。

**Warning signs:**

- 跳转失败率 >1%
- 同一任务在不同客户端显示不同原文
- 客服反馈“任务里的证据找不到了”

**Phase to address:**
**Phase 2（Message→Task 与上下文回链）**

---

### Pitfall 5: 检索权限泄漏（跨房间/跨租户知识串味）

**What goes wrong:**
用户在检索或摘要中看到其无权访问的消息片段，属于高危事故。

**Why it happens:**
向量索引与权限模型解耦；查询时先检索后“弱过滤”；忽略 history visibility / membership 变化。

**How to avoid:**

1. 检索前过滤（pre-filter）必须带 ACL 条件：tenant、room membership、history visibility。
2. 索引文档必须带 `acl_version` 与 `room_visibility` 元数据，权限变更触发增量重索引。
3. 任何检索命中返回前再做一次权限裁决（defense in depth）。
4. 安全测试：构造跨租户、离房后历史、world_readable 边界用例。

**Warning signs:**

- 审计日志出现“检索命中后被后置过滤丢弃比例”持续升高
- 权限变更后摘要仍引用旧受限内容
- 安全测试出现一次越权即应视为 P0

**Phase to address:**
**Phase 3（Retrieval + ACL 安全）**

---

### Pitfall 6: 被污染知识库驱动错误摘要/建议（RAG 注入）

**What goes wrong:**
系统把恶意或噪声文档当真，摘要/决策建议被操控，输出看似可信但方向错误。

**Why it happens:**
把“可检索”误当“可相信”；缺乏 source trust、内容清洗、注入检测。

**How to avoid:**

1. ingestion 增加 trust pipeline：来源白名单、文档清洗、隐藏文本检测、毒化扫描。
2. 生成阶段强制 citations + 证据片段展示，未命中高置信证据时降级为“无法确定”。
3. 对高影响动作（自动创建决策/批量归档）做人审门禁。
4. 定期红队：间接提示注入、投毒文档、冲突知识回归集。

**Warning signs:**

- 同一查询在知识库更新后结论突变且无可解释证据
- 摘要出现“忽略之前指令/执行外部动作”语句
- 用户纠错率、摘要回退率上升

**Phase to address:**
**Phase 3（Retrieval 安全）+ Phase 4（Digest 质量门禁）**

---

### Pitfall 7: 离线摘要“看起来完整但漏关键决策”

**What goes wrong:**
用户依赖摘要回到工作流，但关键 blocker/owner/due date 丢失，反而增加二次确认成本。

**Why it happens:**
只优化“短”和“流畅”，没有 coverage KPI；缺少结构化输出与置信度。

**How to avoid:**

1. 摘要 schema 固定为：`Decisions / Open Questions / Owners / Deadlines / Risks / Sources`。
2. 每条结论附 source event 链接；无来源不得进入摘要正文。
3. 建立摘要质量评估：coverage、fact-consistency、actionability 三指标。
4. 关键房间启用 “digest approval mode”（先草稿后发布）。

**Warning signs:**

- 用户“打开摘要后仍需回看大量原消息”比例高
- 摘要中无 owner 或 due date 的 action item 占比高
- 同一时间窗多次重生摘要内容波动大

**Phase to address:**
**Phase 4（Digest 质量与人审）**

---

### Pitfall 8: 决策沉淀变“墓地卡片”（无生命周期治理）

**What goes wrong:**
Decision cards 快速堆积但很快过期，团队不再信任，最终回到口口相传。

**Why it happens:**
只做“记录”，不做“状态与复审”；缺少 owner、生效范围、失效条件、superseded 链路。

**How to avoid:**

1. 决策卡最小字段强制：`status(accepted/superseded/deprecated)`、owner、effective_date、review_date、supersedes/superseded_by。
2. 每周自动生成“待复审决策队列”；过期未复审在检索中降权。
3. 与任务系统联动：决策变更自动创建迁移任务。
4. 仪表盘跟踪 `stale_decision_ratio` 与 `decision_with_owner_ratio`。

**Warning signs:**

- 无 owner 决策占比持续上升
- 同主题出现多个互相冲突且都标记 accepted 的卡片
- 用户搜索更依赖历史消息而非决策卡

**Phase to address:**
**Phase 4（Decision Capture 治理）**

---

### Pitfall 9: 前台线程被后台索引拖慢（性能反噬）

**What goes wrong:**
输入卡顿、时间线掉帧、切房延迟升高；“效率功能”反而损害核心聊天体验。

**Why it happens:**
索引、摘要、embedding 在 UI 关键路径同步执行；无 backpressure 与任务分级。

**How to avoid:**

1. 将索引/摘要放入后台队列，严格与 timeline 渲染解耦。
2. 任务分级：P0（消息展示）> P1（通知）> P2（索引/摘要）。
3. 设置资源预算：CPU%、内存、I/O；超过阈值自动降级（暂停低优任务）。
4. 建立性能守门：typing latency、frame drop、room-switch p95。

**Warning signs:**

- 输入延迟与索引吞吐量强相关
- 高峰时 `unindexed_event_age` 与 UI 卡顿同时上升
- 用户关闭“智能功能”后体感明显变好

**Phase to address:**
**Phase 5（性能与运行稳定性）**

---

## Technical Debt Patterns

| Shortcut                     | Immediate Benefit | Long-term Cost               | When Acceptable         |
| ---------------------------- | ----------------- | ---------------------------- | ----------------------- |
| 仅用消息文本做任务去重       | 开发快            | 重复任务爆炸、人工清理成本高 | 仅限 demo，生产不可接受 |
| 检索“先召回后弱过滤”         | 准确率看似高      | 越权风险高                   | Never                   |
| 摘要无引用只给结论           | UI 简洁           | 无法审计、纠错困难           | 低风险房间短期可接受    |
| 决策卡不设 owner/review_date | 上线快            | 快速腐烂成信息垃圾           | Never                   |

## Integration Gotchas

| Integration            | Common Mistake                           | Correct Approach                             |
| ---------------------- | ---------------------------------------- | -------------------------------------------- |
| Matrix `/sync` + inbox | 忽略 `limited` timeline gap              | 发现 gap 必须回填 `/rooms/{roomId}/messages` |
| Matrix receipts        | 把 `m.read` 与 `m.read.private` 合并广播 | 私有回执仅本人可见，按 `thread_id` 分类处理  |
| Message→Task 外部系统  | retry 重放无幂等键                       | 使用稳定 idempotency key + 唯一约束映射表    |
| 向量检索               | 与 ACL 脱耦                              | pre-filter + post-check 双层权限裁决         |

## Performance Traps

| Trap                  | Symptoms                   | Prevention                   | When It Breaks               |
| --------------------- | -------------------------- | ---------------------------- | ---------------------------- |
| UI 线程同步 embedding | 输入卡顿/掉帧              | 后台队列 + 预算降级          | 频道高流量或首次全量索引时   |
| 全量重建索引          | CPU 飙升、风扇噪音、耗电高 | 增量索引 + 分片重建          | >50k 消息/工作区明显恶化     |
| 摘要生成无节流        | API/模型费用突增、延迟级联 | 按房间与时间窗做批处理和缓存 | 返工高峰或多端同时回归在线时 |

## Security Mistakes

| Mistake                        | Risk                      | Prevention                           |
| ------------------------------ | ------------------------- | ------------------------------------ |
| 把未信任文档直接入库并参与 RAG | 输出被注入/投毒，误导决策 | 数据源白名单 + 清洗 + 红队测试       |
| 检索结果不做权限复核           | 跨房间/跨租户数据泄漏     | 检索前 ACL 过滤 + 返回前二次权限验证 |
| 摘要不标注 AI 生成与置信度     | 用户过度信任错误结论      | UI 明示 AI 产物 + 引用 + 置信标签    |

## UX Pitfalls

| Pitfall                       | User Impact            | Better Approach                                               |
| ----------------------------- | ---------------------- | ------------------------------------------------------------- |
| inbox 维度过多且不可解释      | “我不知道为什么它在这” | 每条 inbox 项显示进入原因（mention/unread/deferred/assigned） |
| 转任务后失去原聊天上下文      | 需要来回搜索、操作中断 | 任务卡内一键回跳原消息+邻近上下文                             |
| 摘要只给结论不含 action owner | 无法立即执行           | 强制结构化输出（owner + due date + source）                   |

## "Looks Done But Isn’t" Checklist

- [ ] **Unified Inbox:** 已验证 threaded/unthreaded + private/public receipt 组合，不只是单房间 happy path。
- [ ] **Message-to-Task:** 已验证超时重试下不会重复建任务（same source event only one task）。
- [ ] **Retrieval:** 已验证离房后、权限变更后、跨租户查询都不会返回越权片段。
- [ ] **Digest:** 每条关键结论均有 source event；抽样人工复核通过率达标。
- [ ] **Decision Capture:** 每条决策都有 owner + status + review_date，并支持 superseded 链路。

## Recovery Strategies

| Pitfall          | Recovery Cost | Recovery Steps                                                           |
| ---------------- | ------------- | ------------------------------------------------------------------------ |
| 权限泄漏检索结果 | HIGH          | 立即停用检索入口 → 旋转索引访问凭据 → 追溯审计日志 → 按 ACL 全量重建索引 |
| 重复任务风暴     | MEDIUM        | 冻结自动转任务 → 基于 source_event_id 合并去重 → 补写唯一约束与幂等键    |
| 摘要误导关键决策 | MEDIUM-HIGH   | 标记受影响摘要为“需复核” → 触发人工复盘 → 回填更正并通知订阅人           |

## Pitfall-to-Phase Mapping

| Pitfall          | Prevention Phase | Verification                                     |
| ---------------- | ---------------- | ------------------------------------------------ |
| 收件箱真相漂移   | Phase 1          | 回执语义测试矩阵（thread/private/public）全绿    |
| /sync gap 漏洞   | Phase 0          | `timeline.limited` 场景回填后事件连续率=100%     |
| 转任务重复创建   | Phase 2          | chaos 重试测试下 source_event_id 唯一映射        |
| 回链断裂         | Phase 2          | 每日 link integrity 作业成功率>99.9%             |
| 检索 ACL 泄漏    | Phase 3          | 越权检索对抗用例 0 泄漏                          |
| RAG 注入/投毒    | Phase 3/4        | 红队样本集拦截率、错误摘要率达阈值               |
| 摘要漏关键决策   | Phase 4          | coverage + factual consistency 达到发布门槛      |
| 决策墓地化       | Phase 4          | stale_decision_ratio 持续下降且 owner 覆盖率达标 |
| 后台索引拖慢前台 | Phase 5          | typing latency / room-switch p95 不回归          |

## Sources

- Matrix Client-Server API v1.17（官方规范，高置信）
  - `/sync` gaps, `limited` timeline, `next_batch/prev_batch`, 去重建议
  - Receipts: `m.read`, `m.read.private`, threaded receipts, 客户端行为
  - Redactions 与 event replacements (`m.replace`)
  - Server-side search 权限约束
  - URL: https://spec.matrix.org/v1.17/client-server-api/
- OWASP GenAI Top 10 2025（行业基线，中高置信）
  - LLM01 Prompt Injection: https://genai.owasp.org/llmrisk/llm01-prompt-injection/
  - LLM02 Sensitive Information Disclosure: https://genai.owasp.org/llmrisk/llm022025-sensitive-information-disclosure/
  - LLM08 Vector and Embedding Weaknesses: https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/
  - LLM09 Misinformation: https://genai.owasp.org/llmrisk/llm092025-misinformation/
- ADR Practices（决策沉淀方法论，中置信）
  - ADR 首页: https://adr.github.io/
  - ADR Templates（status/decision makers/confirmation 元数据实践）: https://adr.github.io/adr-templates/

---

_Pitfalls research for: Muon v1.0 Chat Efficiency and Knowledge Capture_
_Researched: 2026-03-05_
