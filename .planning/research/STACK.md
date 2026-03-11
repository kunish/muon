# Stack Research

**Domain:** Matrix 桌面协作客户端（聊天效率 + 知识沉淀增量里程碑）
**Researched:** 2026-03-05
**Confidence:** HIGH（核心栈） / MEDIUM（可选增强）

## 推荐栈（仅针对本里程碑新增/变更）

> 结论先行：**v1.0 必须新增“本地 SQLite 检索与工作流存储层”**，其余尽量复用现有 Vue 3 + Pinia + Matrix + Tauri 能力，避免引入向量数据库/外部搜索服务/工作流引擎。

### Core Technologies（Mandatory）

| Technology                     | Version                           | Purpose                                     | Why Recommended                                                                                 |
| ------------------------------ | --------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `@tauri-apps/plugin-sql`       | `^2.3.2`                          | 前端（Vue/Pinia）访问本地 SQLite            | Tauri 官方 v2 插件，支持 SQLite 连接、查询与迁移触发；与当前 Tauri 2.10 栈同代，最小侵入接入。  |
| `tauri-plugin-sql`（Rust）     | `2.3.2` + `features = ["sqlite"]` | Rust 侧数据库驱动与迁移注册                 | 官方插件支持 migration（版本化 schema），满足 inbox/task/decision/retrieval 的演进需求。        |
| SQLite（通过 sqlx/插件）+ FTS5 | SQLite 3.x（FTS5）                | 统一 inbox 索引、跨会话检索、离线摘要素材池 | FTS5 是 SQLite 官方全文检索方案，支持 `MATCH`、`bm25`、高亮与 tokenizer，适合桌面离线优先检索。 |

### Supporting Libraries（Optional / 条件启用）

| Library                    | Version  | Purpose                                                  | When to Use                                                             |
| -------------------------- | -------- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `chrono-node`              | `^2.9.0` | 从消息文本解析日期（如“明天下午前处理”）填充任务截止时间 | 仅在 message-to-task 需要自然语言时间抽取时启用；否则先用手动日期输入。 |
| `@tauri-apps/plugin-store` | `^2.4.2` | 轻量持久化用户偏好（digest 已读游标、triage 视图设置）   | 仅保存小体积 key-value 偏好；**业务数据仍放 SQLite**。                  |
| `minisearch`               | `^7.2.0` | Web/测试环境（非 Tauri）下的内存检索降级                 | 仅用于浏览器预览或测试桩；桌面正式版优先 SQLite FTS5。                  |

### Development Tools

| Tool                  | Purpose                | Notes                                                                             |
| --------------------- | ---------------------- | --------------------------------------------------------------------------------- |
| `drizzle-kit`（可选） | 生成/管理 SQL 迁移文件 | 若团队希望类型化 schema 流程可加；v1.0 也可直接手写 SQL migration，减少工具引入。 |
| `sqlx-cli`（可选）    | 本地调试/验证 SQL      | 适合开发期检查复杂 FTS 查询与索引策略，不必进生产依赖。                           |

## 能力到集成点（与现有 Vue 3 + Pinia + Matrix + Tauri 对齐）

| 能力                         | 必要栈改动                              | 集成点（建议）                                                                                                         |
| ---------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Unified Inbox Triage         | SQLite + plugin-sql                     | `src/matrix` 同步事件后写入 `inbox_items`（mention/unreplied/deferred）；`Pinia inbox store` 读聚合视图。              |
| Message-to-Task              | SQLite + plugin-sql（可选 chrono-node） | 建 `tasks` + `task_links(event_id, room_id)`；在消息操作菜单触发创建任务并保留 jump-back 上下文。                      |
| Cross-Conversation Retrieval | SQLite FTS5                             | `message_index` 主表 + `message_fts` 虚表（外部内容模式）；检索服务在 Tauri command 或前端 repository 层统一封装。     |
| Offline Digest               | SQLite + 现有 `date-fns` + 通知插件     | 维护 `last_seen_cursor` 与摘要快照表；回到前台时按时间窗生成 digest，必要时用 `@tauri-apps/plugin-notification` 提示。 |
| Decision Card Capture        | SQLite + 现有 `zod`                     | `decision_cards`（结论、背景、关联消息、owner、状态）；前端用 zod 校验结构化输入。                                     |

## Installation（建议）

```bash
# Mandatory
pnpm add @tauri-apps/plugin-sql

# Optional（按需）
pnpm add chrono-node @tauri-apps/plugin-store minisearch

# Rust side (in src-tauri)
cargo add tauri-plugin-sql --features sqlite

# Optional Rust side
cargo add tauri-plugin-store
```

## 必须 vs 可选（v1.0 裁剪）

### Mandatory

1. `@tauri-apps/plugin-sql` + `tauri-plugin-sql`（sqlite feature）
2. SQLite schema + migration 机制（至少：inbox/tasks/decision/message_index/summary_state）
3. FTS5 检索索引（支持跨会话消息搜索）

### Optional（不影响 v1.0 主路径）

1. `chrono-node`（自然语言时间）
2. `@tauri-apps/plugin-store`（偏好项）
3. `minisearch`（web 降级）

## Alternatives Considered

| Recommended               | Alternative                             | When to Use Alternative                                        |
| ------------------------- | --------------------------------------- | -------------------------------------------------------------- |
| SQLite FTS5 本地检索      | Elastic/OpenSearch/Meilisearch 外部服务 | 仅在多设备集中检索、跨组织全局搜索且允许服务端基础设施时考虑。 |
| 规则+统计摘要（本地）     | LLM 实时摘要流水线                      | 仅在 v1.0 指标验证后，且明确接受模型成本/隐私复杂度时再引入。  |
| 轻量任务模型（消息→任务） | 完整 BPM/审批引擎                       | 仅在需要复杂依赖图、审批编排、跨系统状态机时考虑。             |

## What NOT to Use（v1.0 明确避免）

| Avoid                                         | Why                                                                                      | Use Instead                                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 向量数据库/`sqlite-vec` 作为默认主检索        | `sqlite-vec` 官方仍标注 pre-v1，接口可能破坏性变化；引入嵌入模型与索引生命周期会放大范围 | 先用 SQLite FTS5 + 关键词/短语检索，向量检索放到后续里程碑验证。 |
| 外部队列与工作流系统（Kafka/Temporal/BullMQ） | 桌面单机场景过重，运维成本远超收益                                                       | 用本地 SQLite 状态机 + 前台/后台生命周期事件即可。               |
| 第二套业务数据库（Dexie 与 SQLite 双写）      | 双写一致性与回放复杂度高，易造成 inbox/task/decision 不一致                              | 业务主数据统一 SQLite；Dexie 仅保留已有 Matrix SDK 或缓存用途。  |
| 先做 PM 双向同步（Jira/Linear/Asana）         | 超出 milestone scope，耦合外部权限/映射模型，拖慢核心验证                                | v1.0 仅做本地 message-to-task + jump-back。                      |

## Stack Patterns by Variant

**If 只发布 Tauri 桌面版（推荐 v1.0）：**

- 使用 SQLite + FTS5 作为唯一业务存储/检索层
- 因为离线能力、迁移管理和一致性最简单

**If 需要浏览器预览版并保持功能演示：**

- 用 `minisearch` 做检索降级 + `idb-keyval/dexie` 做临时状态
- 因为 Web 环境不直接复用 Tauri SQL 插件

## Version Compatibility

| Package A                 | Compatible With                 | Notes                                           |
| ------------------------- | ------------------------------- | ----------------------------------------------- |
| `tauri@2.10.0`            | `tauri-plugin-sql@2.3.2`        | 同属 Tauri v2 生态。                            |
| `@tauri-apps/api@^2.10.1` | `@tauri-apps/plugin-sql@^2.3.2` | JS guest bindings 与 v2 插件兼容。              |
| Rust `1.77.2+`            | Tauri SQL/Store plugins         | Tauri 文档明确插件最低 Rust 版本要求为 1.77.2。 |

## Sources

- Tauri SQL 插件文档（官方）: https://v2.tauri.app/plugin/sql/ （HIGH，含迁移、权限、平台、更新时间 2025-11-04）
- Tauri Store 插件文档（官方）: https://v2.tauri.app/plugin/store/ （HIGH，含权限与使用方式，更新时间 2025-11-10）
- SQLite FTS5 官方文档: https://www.sqlite.org/fts5.html （HIGH，FTS5 能力与限制）
- Matrix JS SDK 文档: https://matrix-org.github.io/matrix-js-sdk/ （MEDIUM，确认本地 store/同步能力背景）
- npm registry version checks（2026-03-05）: `npm view @tauri-apps/plugin-sql|plugin-store|chrono-node|minisearch` （HIGH，版本有效性）
- crates.io version checks（2026-03-05）: `cargo search tauri-plugin-sql|tauri-plugin-store|rusqlite` （HIGH，Rust 侧版本有效性）
- sqlite-vec 仓库 README: https://github.com/asg017/sqlite-vec （MEDIUM，pre-v1 风险判断）

---

_Stack research for: Muon v1.0 Chat Efficiency and Knowledge Capture milestone_
_Researched: 2026-03-05_
