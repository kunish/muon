# Roadmap: Muon Milestone v1.0

## Overview

本路线图围绕 v1.0「Chat Efficiency and Knowledge Capture」里程碑展开，按“先完成高流量消息分拣与执行闭环，再完成跨会话检索与知识沉淀，最后做稳定性兜底”的顺序推进。每个阶段都交付可独立验证的用户能力，并确保全部 v1 需求被且仅被映射一次。

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Unified Inbox Triage** - 用户可在一个入口集中处理高优先级消息并回到原文上下文。 (completed 2026-03-05)
- [x] **Phase 2: Defer and Message-to-Task Loop** - 用户可延后消息并将消息转为可追踪任务形成执行闭环。 (completed 2026-03-05)
- [ ] **Phase 3: Cross-Conversation Retrieval** - 用户可跨会话检索相关消息且结果严格受权限约束。
- [ ] **Phase 4: Offline Digest and Decision Capture** - 用户可离线回归重点、验证引用并沉淀可复用决策。
- [ ] **Phase 5: Reliability and Performance Consistency** - 用户在重连与高负载场景下仍获得一致且流畅的效率体验。

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
**Plans**: 5 plans

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
**Plans**: TBD

### Phase 5: Reliability and Performance Consistency
**Goal**: 用户在重连恢复与日常高频使用中，收件箱与检索体验保持一致、无明显卡顿。
**Depends on**: Phase 4
**Requirements**: RELI-01, RELI-02
**Success Criteria** (what must be TRUE):
  1. 用户在断线重连或同步缺口恢复后，收件箱和任务状态保持一致且无静默丢项。
  2. 用户在执行收件箱处理与检索操作时，不会感知明显输入或导航延迟。
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Unified Inbox Triage | 3/3 | Complete   | 2026-03-05 |
| 2. Defer and Message-to-Task Loop | 5/5 | Complete   | 2026-03-05 |
| 3. Cross-Conversation Retrieval | 1/2 | In Progress|  |
| 4. Offline Digest and Decision Capture | 0/TBD | Not started | - |
| 5. Reliability and Performance Consistency | 0/TBD | Not started | - |
