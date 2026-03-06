# Roadmap: Muon Milestone v1.0

## Overview

本路线图围绕 v1.0「Chat Efficiency and Knowledge Capture」里程碑展开，按“先完成高流量消息分拣与执行闭环，再完成跨会话检索与知识沉淀，最后做稳定性兜底”的顺序推进。每个阶段都交付可独立验证的用户能力，并确保全部 v1 需求被且仅被映射一次。

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Unified Inbox Triage** - 用户可在一个入口集中处理高优先级消息并回到原文上下文。 (completed 2026-03-05)
- [x] **Phase 2: Defer and Message-to-Task Loop** - 用户可延后消息并将消息转为可追踪任务形成执行闭环。 (completed 2026-03-05)
- [x] **Phase 3: Cross-Conversation Retrieval** - 用户可跨会话检索相关消息且结果严格受权限约束。 (completed 2026-03-06)
- [x] **Phase 4: Offline Digest and Decision Capture** - 用户可离线回归重点、验证引用并沉淀可复用决策。 (completed 2026-03-06)
- [x] **Phase 5: Reliability and Performance Consistency** - 用户在重连与高负载场景下仍获得一致且流畅的效率体验。 (completed 2026-03-06)
- [ ] **Phase 6: Search Surface Integration and Retrieval Completion** - 用户可从真实聊天搜索入口完成跨会话检索、分页与结果回跳，不再停留在未接线实现。 
- [ ] **Phase 7: Offline Digest Reliability and Knowledge Continuity** - 用户回归后可稳定看到离线 digest、验证引用，并让 digest 驱动的建议链路可靠可用。 

## Phase Details

### Phase 1: Unified Inbox Triage
**Goal**: 用户可以在统一收件箱中识别并批量处理高优先级事项，并能跳转回消息上下文。
**Depends on**: Nothing (first phase)
**Requirements**: INBX-01, INBX-02, INBX-03
**Success Criteria** (what must be TRUE):
  1. 用户可以在一个统一收件箱中看到提及、优先未读和待回复项。
  2. 用户可以按项目类型过滤，并对选中项进行批量“已处理”操作。
  3. 用户可以从任一收件箱项一键跳转到源消息，并看到其前后文。
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — 定义 unified inbox 契约并实现聚合/过滤/批量 processed 的本地持久化数据层。
- [x] 01-02-PLAN.md — 实现 Matrix 源消息上下文加载 API（目标消息+前后文）并完成单测。
- [x] 01-03-PLAN.md — 接入 unified inbox UI 到 DM 侧边栏并打通跳转到源消息上下文。

### Phase 2: Defer and Message-to-Task Loop
**Goal**: 用户可以把消息延后处理并转为任务，在执行中随时回到原始对话语境。
**Depends on**: Phase 1
**Requirements**: INBX-04, INBX-05, TASK-01, TASK-02, TASK-03
**Success Criteria** (what must be TRUE):
  1. 用户可以为收件箱事项设置稍后提醒，并在个人 defer 队列中查看。
  2. 用户可以在 defer 队列中将事项标记为完成或归档。
  3. 用户可以从任意消息创建带负责人、截止时间、状态的任务。
  4. 用户可以在任务面板中把任务在 todo/doing/done 之间流转。
  5. 用户可以从任务详情准确跳回对应源消息。
**Plans**: 8 plans

Plans:
- [x] 02-01-PLAN.md — 定义 defer/task 领域合同与持久化状态机（含 Wave 0 测试骨架）。
- [x] 02-02-PLAN.md — 交付 defer 双入口与 defer 队列 Active/History 处理闭环。
- [x] 02-03-PLAN.md — 实现消息转任务与任务状态流转主链路。
- [x] 02-04-PLAN.md — 打通任务回跳源消息链路并完成侧栏入口协同。
- [x] 02-05-PLAN.md — 修复 DM 侧栏 defer 滚动阻断并补齐长列表可达性回归测试。

### Phase 3: Cross-Conversation Retrieval
**Goal**: 用户可以跨会话快速找回相关消息，同时系统保证检索结果不越权。
**Depends on**: Phase 2
**Requirements**: RETR-01, RETR-02
**Success Criteria** (what must be TRUE):
  1. 用户可以按关键词跨会话搜索并获得排序后的相关结果。
  2. 用户检索到的结果仅来自自己当前有访问权限的会话。
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md — 交付 Matrix 跨会话检索服务（joined-room 授权范围 + 分页）及单测护栏。
- [ ] 03-02-PLAN.md — 接入 GlobalSearch 跨会话检索 UI 与结果回跳链路并完成组件验证。

### Phase 4: Offline Digest and Decision Capture
**Goal**: 用户可以在离线回归时快速理解关键信息，并把讨论结论沉淀为可追溯知识资产。
**Depends on**: Phase 3
**Requirements**: DIGE-01, DIGE-02, DIGE-03, DECI-01, DECI-02, DECI-03
**Success Criteria** (what must be TRUE):
  1. 用户返回后可以查看离线期间的精简 digest，并按“与我责任/关注/提及”排序关注重点。
  2. 用户可以从 digest 条目打开源消息引用，验证每条摘要结论。
  3. 用户可以创建包含结论、背景、owner、状态和关联消息的决策卡。
  4. 用户可以对 AI 建议的行动项与阻塞项进行接受或拒绝。
  5. 用户可以提出跨会话问题并获得带可追溯引用的回答。
**Plans**: 8 plans

Plans:
- [x] 04-01-PLAN.md — 建立 Phase 4 共享知识合同（citation-first）与 Dexie 离线持久化底座。
- [x] 04-02-PLAN.md — 交付离线 digest 生成/相关性排序/引用回跳闭环。
- [x] 04-03-PLAN.md — 交付决策卡创建与 AI 建议 accept/reject 审计链路。
- [x] 04-04-PLAN.md — 交付跨会话 QA 服务与问答面板（带 citations）。
- [x] 04-05-PLAN.md — 接线统一 Knowledge 侧栏入口并集成 digest/decision/qa 三个子视图。
- [x] 04-06-PLAN.md — 回填 digest 历史回读与 Knowledge 面板 reopen hydration 缺口。
- [x] 04-07-PLAN.md — 修复 decision 回读、linked-message 回跳与 digest-backed pending suggestions 主链路。
- [x] 04-08-PLAN.md — 收口剩余 Phase 4 gap closure 与最终验证问题。

### Phase 5: Reliability and Performance Consistency
**Goal**: 用户在重连恢复与日常高频使用中，收件箱与检索体验保持一致、无明显卡顿。
**Depends on**: Phase 4
**Requirements**: RELI-01, RELI-02
**Success Criteria** (what must be TRUE):
  1. 用户在断线重连或同步缺口恢复后，收件箱和任务状态保持一致且无静默丢项。
  2. 用户在执行收件箱处理与检索操作时，不会感知明显输入或导航延迟。
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md — 为 reconnect/catch-up 恢复链路补齐 RELI-01 的 RED→GREEN 测试与 canonical inbox recovery 实现。
- [x] 05-02-PLAN.md — 为 UnifiedInbox / GlobalSearch 补齐 RELI-02 的性能回归测试、虚拟化渲染与有预算的回跳预加载。
- [x] 05-03-PLAN.md — 为 taskStore 补齐 RELI-01 的 reconnect/bootstrap continuity 测试与 hydrate 强化。

### Phase 6: Search Surface Integration and Retrieval Completion
**Goal**: 用户可从真实聊天搜索入口完成跨会话检索、分页与结果回跳，并实际获得受权限约束且流畅的搜索体验。
**Depends on**: Phase 5
**Requirements**: RETR-01, RETR-02, RELI-02
**Gap Closure:** Closes gaps from audit
**Success Criteria** (what must be TRUE):
  1. 用户从现有聊天搜索入口打开的是真实跨会话检索面板，而不是仅限当前房间的旧搜索视图。
  2. 用户可以在生产搜索流中完成检索、分页和结果回跳，且回跳仍走 bounded preload 链路。
  3. 用户只能看到当前有权限访问的会话结果，且该链路在真实挂载点下被重新验证。
**Plans**: TBD

### Phase 7: Offline Digest Reliability and Knowledge Continuity
**Goal**: 用户回归后可稳定读取离线 digest、打开 citations，并让 digest 驱动的建议链路具备可靠输入。
**Depends on**: Phase 6
**Requirements**: DIGE-01, DIGE-02, DIGE-03, DECI-02
**Gap Closure:** Closes gaps from audit
**Success Criteria** (what must be TRUE):
  1. 用户重新打开 Knowledge 面板时，已回读的 digest 不会被空 session 覆盖。
  2. 用户离线期间已同步到本地的消息会按 away-window 时间窗稳定进入 digest。
  3. 用户可以从稳定可见的 digest 条目打开 citation，并让 digest-backed suggestions 在 decision 链路中可靠出现。
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Unified Inbox Triage | 3/3 | Complete   | 2026-03-05 |
| 2. Defer and Message-to-Task Loop | 5/5 | Complete   | 2026-03-05 |
| 3. Cross-Conversation Retrieval | 2/2 | Complete   | 2026-03-06 |
| 4. Offline Digest and Decision Capture | 8/8 | Complete | 2026-03-06 |
| 5. Reliability and Performance Consistency | 3/3 | Complete | 2026-03-06 |
| 6. Search Surface Integration and Retrieval Completion | 0/TBD | Not started | - |
| 7. Offline Digest Reliability and Knowledge Continuity | 0/TBD | Not started | - |
