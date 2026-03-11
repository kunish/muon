# Feature Research

**Domain:** 协作聊天产品（增量里程碑：聊天效率与知识沉淀）
**Researched:** 2026-03-05
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature                                | Why Expected                                                         | Complexity | Notes                                                            |
| -------------------------------------- | -------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------- |
| 统一收件箱（@提及、未读、回复）        | Slack/Teams/Discord 都有统一活动流或 Inbox；高流量协作里这是基础入口 | MEDIUM     | 必须支持过滤（未读/提及/回复）、批量已读、快速跳转到原消息       |
| 稍后处理（defer/snooze）与个人待办队列 | Slack Later 已把“保存+提醒+完成”做成默认个人处理流                   | MEDIUM     | 至少要有：保存、提醒时间、完成/归档状态、回到原上下文            |
| 从收件箱一跳回源消息（含上下文）       | 强产品默认“从通知直达原线程”，否则处理成本高                         | LOW        | 跳转时应定位到原消息并加载前后若干条上下文，避免“只跳到频道底部” |
| 消息转任务（含责任人、截止时间、回链） | Slack+Asana/Teams+Planner 等已让“讨论→执行”成为常规预期              | MEDIUM     | 任务必须保留消息 permalink 与来源会话，支持任务状态回写          |
| 跨会话检索（关键词+语义，权限感知）    | 现代协作产品都强调“在对话和外部知识里找答案”                         | HIGH       | 先做权限内检索与可追溯结果；语义召回可先限定在消息正文+标题      |
| 离线回归摘要（catch-up digest）基础版  | Teams/Slack 都在强化 recap；用户越来越期待“回来后快速追平”           | HIGH       | MVP 先做时间窗摘要（我离线期间）+ 关键事项链接；必须可展开到原文 |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature                              | Value Proposition                                    | Complexity | Notes                                                          |
| ------------------------------------ | ---------------------------------------------------- | ---------- | -------------------------------------------------------------- |
| 决策卡片（Decision Card）            | 将“聊天里拍板”结构化沉淀，减少反复追问“为什么这么定” | MEDIUM     | 建议字段：决策结论、背景、备选项、决策人、时间、关联消息与任务 |
| 摘要中自动提取“行动项/阻塞项/需确认” | 比泛摘要更可执行，直接推动下一步动作                 | HIGH       | 必须输出证据链接（引用消息）；无引用不入库                     |
| 跨会话问答卡（带引用）               | 用户可直接问“这个决策是谁定的？”并拿到可追溯答案     | HIGH       | 回答需显示来源片段与时间，支持“跳转源消息”                     |
| 个人化回归视角（按我负责/我关注）    | 同样是离线 digest，但更贴合个人职责，降噪明显        | MEDIUM     | 结合 @我、我创建/负责任务、我关注会话做排序                    |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature                     | Why Requested        | Why Problematic                            | Alternative                                |
| --------------------------- | -------------------- | ------------------------------------------ | ------------------------------------------ |
| “所有消息自动转任务”        | 看起来最省事         | 噪声极高，任务泛滥，团队迅速失去信任       | 默认手动转任务 + AI 建议草稿（需人工确认） |
| “纯 AI 摘要，不展示引用”    | 界面更干净           | 无法校验，容易幻觉，争议时不可审计         | 摘要必须引用消息证据，可一键跳转           |
| “一次性做全量双向 PM 同步”  | 领导层常希望一步到位 | 集成复杂度和故障面急剧上升，拖慢里程碑验证 | 先做站内消息→任务闭环，外部同步放 v1.x     |
| “默认自动清空/已读所有通知” | 表面上快速清零       | 用户错过关键事项，形成隐性漏项             | 保留显式批量操作 + 高优先级二次确认        |

## Feature Dependencies

```
[统一收件箱]
    ├──requires──> [事件优先级模型（@提及/未读/回复）]
    └──requires──> [消息跳转与上下文加载]

[稍后处理（defer）]
    └──requires──> [统一收件箱]

[消息转任务]
    ├──requires──> [消息 permalink/上下文锚点]
    └──enhances──> [统一收件箱]（可从收件箱直接转任务）

[离线回归摘要]
    ├──requires──> [事件优先级模型]
    ├──requires──> [跨会话检索索引]
    └──enhances──> [统一收件箱]（先看摘要再处理）

[决策卡片]
    ├──requires──> [消息跳转与上下文加载]
    └──enhances──> [跨会话检索]（作为高价值结构化语料）
```

### Dependency Notes

- **稍后处理 requires 统一收件箱：** defer 的对象是“待处理项”；没有统一入口会导致状态分裂。
- **消息转任务 requires 消息锚点：** 若无稳定回链，任务与讨论会断裂，复盘困难。
- **离线回归摘要 requires 检索索引：** 没有索引只能做浅层拼接，难以提取关键变化。
- **决策卡片 enhances 检索：** 决策是高密度知识单元，能显著提升后续问答命中质量。

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] 统一收件箱（@提及/未读/回复 + 过滤 + 批量已读）— 验证“集中处理”是否减少切换成本
- [ ] 稍后处理队列（保存、提醒、完成）— 验证“先抓住再处理”流程
- [ ] 消息转任务（责任人/截止时间/状态 + 回跳原消息）— 验证“讨论到执行”的闭环
- [ ] 基础离线 digest（时间窗摘要 + 引用链接）— 验证回归效率提升

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] 语义检索 + 自然语言问答（带引用）— 当关键词检索召回不足时上线
- [ ] 决策卡片模板与列表页 — 当团队出现“决策追溯”痛点时上线
- [ ] AI 行动项建议（需确认）— 当转任务操作频次足够高时上线

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] 外部 PM 套件双向同步（Jira/Asana/Linear 全量）— 依赖稳定的数据模型与冲突策略
- [ ] 自动化决策抽取并自动发布卡片 — 风险高，需高准确率与治理机制

## Feature Prioritization Matrix

| Feature                   | User Value  | Implementation Cost | Priority |
| ------------------------- | ----------- | ------------------- | -------- |
| 统一收件箱（过滤+批处理） | HIGH        | MEDIUM              | P1       |
| 稍后处理（defer）         | HIGH        | MEDIUM              | P1       |
| 消息转任务（含回链）      | HIGH        | MEDIUM              | P1       |
| 基础离线 digest（带引用） | HIGH        | HIGH                | P1       |
| 语义检索/问答（带引用）   | HIGH        | HIGH                | P2       |
| 决策卡片                  | MEDIUM-HIGH | MEDIUM              | P2       |
| 外部 PM 双向同步          | MEDIUM      | HIGH                | P3       |

**Priority key:**

- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature      | Competitor A                                           | Competitor B                                            | Our Approach                                         |
| ------------ | ------------------------------------------------------ | ------------------------------------------------------- | ---------------------------------------------------- |
| 统一收件箱   | Microsoft Teams Activity：按未读/提及过滤、批量已读    | Discord Inbox：Mentions + Unreads，支持 Jump 与标记已读 | 收敛到单入口，并强化“处理状态”（进行中/完成/稍后）   |
| 稍后处理     | Slack Later：In progress/Archived/Completed + Reminder | 多数产品仅“星标/保存”，缺少完成态                       | 采用“待办化保存”而非简单收藏                         |
| 消息转任务   | Slack + Asana：消息一键转任务，带 assignee/due date    | Teams 常借助 Planner/Loop/第三方                        | 先做内置任务闭环，后扩展外部同步                     |
| 离线回归摘要 | Slack AI：线程/频道摘要与 daily recap                  | Teams Recap/活动流可快速补看                            | 强制“摘要带引用”，保障可追溯与可信度                 |
| 决策沉淀     | Confluence 有 decision 报表与聚合                      | 许多聊天工具只停留在消息历史                            | 以“决策卡片 + 来源消息 + 关联任务”形成可复用知识单元 |

## Sources

- Slack Help: Save messages and files for later — https://slack.com/help/articles/360042650274-Save-messages-and-files-for-later (HIGH)
- Microsoft Support: Explore the Activity feed in Teams — https://support.microsoft.com/en-us/office/explore-the-activity-feed-in-microsoft-teams-91c635a1-644a-4c60-9c98-233db3e13a56 (HIGH)
- Discord Support: Inbox FAQ — https://support.discord.com/hc/en-us/articles/360045027712-Inbox-FAQ (HIGH)
- Asana: Slack + Asana integration — https://asana.com/apps/slack (HIGH)
- Slack feature page: AI in Slack（channel/thread summary, daily recaps）— https://slack.com/features/ai (MEDIUM，营销页但为官方)
- Slack feature page: Enterprise Search（跨应用检索、权限感知）— https://slack.com/features/enterprise-search (MEDIUM，营销页但为官方)
- Atlassian Confluence: Decision report macro — https://support.atlassian.com/confluence-cloud/docs/insert-the-decision-report-macro/ (HIGH)
- Atlassian Confluence: Use Rovo to search for answers — https://support.atlassian.com/confluence-cloud/docs/use-atlassian-intelligence-to-search-for-answers/ (HIGH)

---

_Feature research for: Muon v1.0 Chat Efficiency and Knowledge Capture milestone_
_Researched: 2026-03-05_
