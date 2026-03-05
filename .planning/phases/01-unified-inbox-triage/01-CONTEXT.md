## Decisions

1. **priority unread 规则（锁定）**
   - 采用：**高亮或 @提及优先**。
   - 即：以 Matrix highlight / mention 作为优先未读的核心判定。

2. **INBX-02 processed 持久化策略（锁定）**
   - 采用：**本地持久化**（localStorage 或 IndexedDB）。
   - 目标：Phase 1 先保证可用与低风险落地，不做跨设备同步。

## Claude's Discretion

- localStorage 与 IndexedDB 的具体选型、抽象层设计、键命名规范。
- reply-needed 的最小可测试规则（在不引入复杂 NLP 的前提下）。
- inbox item 排序细节（同优先级下按时间/房间等规则）。
- INBX-03 上下文加载在 SDK API 与 REST `/context` 间的调用封装策略。

## Deferred Ideas

- processed 状态跨设备同步（例如 Matrix account data/服务端策略）
- 智能优先级（关键词权重、语义分类、SLA 多维评分）
- 高级动画与复杂收件箱可视化
