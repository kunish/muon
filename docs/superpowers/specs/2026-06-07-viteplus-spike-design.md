# Vite+ 可行性 Spike — 设计

- **日期**：2026-06-07
- **状态**：已批准设计，待写实施计划
- **作者**：brainstorming 会话
- **所属大目标**：将 muon monorepo 整体重构为 Vite+ 全家桶（拆为 5 个 sub-project：A Vite+ 工具链迁移 / B admin 全栈对齐 / C desktop tanstack 统一 / D packages 库构建 / E Vitesse unplugin 自动化）。本文件只覆盖 **A 的前置 spike**。

## 背景与动机

muon 已经是一套较完整的 Vite 栈：`apps/desktop`（electron-vite 5 + Vite 8 + Vue 3 + vue-router 5 + @tanstack/vue-{store,query,table,form,virtual} + Tailwind 4 + reka-ui + vitest + tiptap）、`apps/admin`（Vite + Vue 3，缺 query/store/reka-ui/i18n/vitest）、`packages/ui`（Vite + Storybook + vitest）、`apps/api`（Node + tsx，后端）、`packages/{rich-text,enterprise-contracts}`（仅 tsc 类型检查的源码包）。

用户希望迁移到 **Vite+（viteplus.dev，VoidZero 出品的统一工具链）**：用单一 `vp` CLI 统合 dev/build/test/lint/format/typecheck/pack/任务编排，底层为 Vite 8 + Vitest + Rolldown + Oxlint + Oxfmt + tsgo + tsdown。

迁移前已确认三个硬约束，它们决定 Vite+ 在本项目能走多远，必须先实测而非凭文档假设：

1. **electron-vite 兼容性未知**：desktop 用 `electron-vite` CLI（非普通 Vite 项目）。Vite+ 把 `vite` 别名为 `vite-plus`，electron-vite 内部 `import 'vite'` 理论上拿到兼容的 Vite 8，但官方文档无任何 Electron 支持表述。
2. **Oxlint 不支持 Vue 模板规则**：oxlint 无 `vue/*` 规则、不做 template lint，无法完整替代现有 `@antfu/eslint-config`。
3. **tsgo 不认 `.vue`**：`vp check` 的类型检查走 tsgo（TS7），但 tsgo 不理解 SFC；纯 TS 包没问题，`.vue` 仍需 `vue-tsc`（或实验性 `vue-tsgo`）。

迁移门槛（Vite 8+ / Vitest 4.1+）项目已满足（`vite ^8.0.10` / `vitest ^4.1.5`）。

## 目标 / 非目标

**目标**

- 在隔离环境实测 Vite+，对每条关键假设拿到明确结论。
- 产出 go/no-go 决策报告；若 go，给出「A 全量迁移」的具体形态。

**非目标（YAGNI）**

- 不做 sub-project B/C/D/E。
- 不在 spike 内完成正式迁移、不把工具链变更并入 main。
- 不追求每条 `vp` 命令完美，只要每条假设有明确结论。

## 隔离策略

- `git worktree add ../muon-viteplus-spike -b spike/viteplus`，所有验证在该 worktree 内进行。
- 工具链以项目级依赖引入：`pnpm add -D vite-plus`，统一用 `pnpm exec vp …` 调用，**不全局安装、不修改用户全局环境**。
- worktree 内 `pnpm install` 生成独立 `node_modules`，与 main 工作树隔离。
- 验证完成后 worktree 整体丢弃（`git worktree remove`），结论写入本 specs 目录的报告。

## 验证矩阵

### 🔴 致命（任一不过 = no-go，或将 A 缩小为「仅非-electron 包」）

| ID | 假设 | 验证动作 | 成功判据 |
|----|------|----------|----------|
| H1 | electron-vite × Vite+ 兼容 | 在 desktop 跑 `vp migrate` 后执行 `electron-vite dev` 与 `electron-vite build`（或 vp 接管后的等价命令） | dev 服务器起得来、HMR 正常；build 产出 `apps/desktop/out/**`；打包后应用能启动 |
| H2 | 测试链路兼容 | `vp test` 跑现有 vitest 套件（msw + jsdom + @vue/test-utils） | 通过率 ≥ 当前 `vitest run`，无配置不兼容导致的整体失败 |
| H3 | `.vue` 类型检查 | 在 desktop 跑 `vp check` 的类型检查；对照 `vue-tsc --noEmit` | 明确 tsgo 是否覆盖 SFC；给出兜底（保留 vue-tsc / 试 vue-tsgo）的结论 |

H1 失败的止损分支：desktop 不纳入 Vite+，A 缩小为「api/contracts/rich-text/ui/admin 用 Vite+，desktop 保留 electron-vite 原工具链」。

### 🟡 重要（影响形态，不否决）

| ID | 假设 | 验证动作 | 成功判据 |
|----|------|----------|----------|
| H4 | oxlint 对 Vue 覆盖度 | desktop 跑 oxlint，与 `@antfu/eslint-config` 结果对比 | 量化漏掉的 `vue/*` / 模板规则，产出混合策略：oxlint 管 JS/TS 正确性 + 保留 eslint 管 vue |
| H5 | `vp pack` 打纯 TS 包 | 对 `packages/enterprise-contracts`、`packages/rich-text` 跑 `vp pack` | 产物含正确 JS + DTS，能被 desktop/admin 消费 |
| H6 | `vp run` 缓存编排 | 用 `vp run` 复现根 `package.json` 的 `--filter` 编排（build/test/lint） | 任务依赖顺序正确、缓存命中、可替代现有 pnpm 脚本 |

### ⚪ 顺带观察

- Storybook 8.6 + Vite 8 在 Vite+ 环境是否仍能 `storybook dev`。
- oxfmt vs prettier 的格式差异面（评估迁移成本，不在 spike 内统一）。

## 执行顺序（早失败早止损）

0. **准备**：建 worktree → `pnpm install` → `pnpm add -D vite-plus` → `pnpm exec vp --version` 确认可用；阅读 `vp help` / `vp help migrate`。
1. **contracts 热身（低风险）**：对 `packages/enterprise-contracts` 跑 `vp migrate --no-interactive` + `vp pack`，验 H5 与迁移机制不破坏现有配置。
2. **desktop 验 H1（头号关口）**：迁移 desktop 并实测 electron-vite dev/build。卡死且约 30 分钟无解 → 记录现象、出缩小版 no-go、转向止损分支，不死磕。
3. **desktop 验 H2 / H3 / H4**：测试、类型检查、lint 覆盖。
4. **根 + ui 验 H6 + Storybook**。
5. **写报告**。

迁移命令以官方迁移 prompt 为准：`vp migrate --no-interactive` 在 workspace 根；迁移后确认 `vite` → `vite-plus`、`vitest` → `vite-plus/test` 的 import 改写，pnpm 下保留被别名的 `vite`/`vitest` 条目以维持 workspace override。

## 止损规则

- 致命假设（H1/H2/H3）卡死且约 30 分钟内无解 → 记录现象与暂定结论，继续下一条。
- 绝不静默兜底或伪造通过：失败如实记入报告（呼应「让失败可见」原则）。

## 产出物

`docs/superpowers/specs/2026-06-07-viteplus-spike-report.md`，包含：

1. 每条假设（H1–H6 + 顺带项）的实测结论与证据（命令输出摘要）。
2. **go / no-go / 缩小版 go** 的明确判定。
3. 若 go：A 全量迁移的形态——哪些命令换 `vp`、哪些保留 `vue-tsc` / eslint-vue 兜底、混合 lint 策略、根脚本如何改、对 catalog 与 CI 的影响。
4. 不把任何工具链变更并入 main 的确认；worktree 清理记录。

## 已知约束与风险

- electron-vite 是 spike 的核心不确定性，结论直接决定 A 的范围。
- oxlint / tsgo 对 Vue 的覆盖缺口已知存在，spike 的任务是量化它并给混合方案，而非证明其能完全替代。
- Vite+ 处于 alpha，行为可能随版本变化；报告需记录实测时的 `vite-plus` 版本。
