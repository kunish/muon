# Vite+ 可行性 Spike 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在隔离 worktree 里实测 Vite+，对 6 条关键假设拿到明确结论，产出 go/no-go 决策报告。

**Architecture:** 这是探索性 spike，不写生产代码。每个 task = 验证一条假设：跑确切的 `vp` 命令 → 按成功判据判定 → 把结论与证据追加进报告。工具链实验全部在 `../muon-viteplus-spike` worktree（分支 `spike/viteplus`）内进行，**报告写回 main 工作树**，worktree 最终整体丢弃，零变更并入 main。

**Tech Stack:** Vite+ (`vite-plus` / `vp` CLI，alpha)、底层 Vite 8 + Vitest 4 + Rolldown + Oxlint + Oxfmt + tsgo + tsdown；被测项目为 pnpm monorepo（electron-vite desktop + Vue 3 + Storybook）。

**关联 spec:** `docs/superpowers/specs/2026-06-07-viteplus-spike-design.md`

---

## 执行须知（alpha 应对）

- Vite+ 处于 alpha：**每个命令执行前先跑 `pnpm exec vp help <subcommand>` 确认真实命令面**。文档命令与实际不符时，以实际为准。
- 命令不存在 / 行为不符预期，本身就是该假设的有效结论——记录现象，**不要卡死**，继续下一条。
- 致命假设（H1/H2/H3）若卡死且约 30 分钟无解：记录现象 + 暂定结论，进入止损分支或下一 task。
- **报告路径（main 工作树绝对路径）**：`/Users/shikun/Developer/opensource/muon/docs/superpowers/specs/2026-06-07-viteplus-spike-report.md`。每个 task 追加对应小节，证据用命令输出摘要。
- 不伪造通过：失败如实记录。

---

## File Structure

| 路径 | 责任 | 位置 |
|------|------|------|
| `../muon-viteplus-spike/` | 隔离 worktree，承载所有工具链实验 | worktree |
| `../muon-viteplus-spike/**`（vp migrate 改动的 vite.config.ts / package.json 等） | 实验产物，仅供 diff 观察，不并入 main | worktree |
| `docs/superpowers/specs/2026-06-07-viteplus-spike-report.md` | 最终 go/no-go 报告 | **main 工作树** |

---

## Task 0: 准备隔离 worktree 与 Vite+

**Files:**
- Create: `../muon-viteplus-spike/`（worktree）
- Create: `/Users/shikun/Developer/opensource/muon/docs/superpowers/specs/2026-06-07-viteplus-spike-report.md`（报告骨架）

- [ ] **Step 1: 用 using-git-worktrees skill 创建隔离 worktree**

REQUIRED SUB-SKILL: 先 invoke `superpowers:using-git-worktrees`。等价底层命令：

```bash
cd /Users/shikun/Developer/opensource/muon
git worktree add ../muon-viteplus-spike -b spike/viteplus
```

Expected: 新建 worktree 目录，分支 `spike/viteplus`。

- [ ] **Step 2: 在 worktree 内安装依赖与 Vite+**

```bash
cd ../muon-viteplus-spike
pnpm install
pnpm add -D vite-plus -w
```

Expected: `node_modules` 生成；`vite-plus` 进入根 `devDependencies`。若 `-w` 不被接受（catalog 项目），改为 `pnpm add -D vite-plus --workspace-root`。

- [ ] **Step 3: 确认 vp 可用并探查命令面**

```bash
pnpm exec vp --version
pnpm exec vp help
pnpm exec vp help migrate
```

Expected: 打印版本号（**记入报告头部：实测 vite-plus 版本**）；列出 dev/check/build/test/run/pack/migrate 等子命令。命令不可用即为重大负面信号，记入报告并评估是否继续。

- [ ] **Step 4: 写报告骨架到 main 工作树**

在 `/Users/shikun/Developer/opensource/muon/docs/superpowers/specs/2026-06-07-viteplus-spike-report.md` 写入：标题、实测 `vite-plus` 版本、日期 2026-06-07、以及 H1–H6 + 顺带项 + 最终判定的空小节。

- [ ] **Step 5: 在 worktree 提交基线**

```bash
cd ../muon-viteplus-spike
git add -A && git commit -m "chore(spike): baseline before vp migrate"
```

Expected: 基线提交，后续可 `git diff` 看 `vp migrate` 改了什么。

---

## Task 1: H5 — contracts 热身（vp migrate + vp pack，低风险）

**Files:**
- Modify: `../muon-viteplus-spike/packages/enterprise-contracts/**`（vp migrate 产物）
- Append: 报告 `## H5` 小节

- [ ] **Step 1: 确认 pack 命令面**

```bash
cd ../muon-viteplus-spike
pnpm exec vp help migrate
pnpm exec vp help pack
```

Expected: 了解 `vp migrate --no-interactive` 与 `vp pack` 的真实参数。

- [ ] **Step 2: 迁移 contracts 包并观察 diff**

```bash
pnpm exec vp migrate --no-interactive
git --no-pager diff --stat
```

Expected: 看 migrate 改了哪些文件（vite.config.ts / package.json scripts / import 改写）。记录 diff 摘要。

- [ ] **Step 3: 对 contracts 跑 vp pack**

```bash
pnpm --filter @muon/enterprise-contracts exec vp pack
ls -la packages/enterprise-contracts/dist 2>/dev/null || find packages/enterprise-contracts -name '*.d.ts' -newer package.json
```

Expected（判据 H5）：产出 JS + `.d.ts`。检查 DTS 是否完整、exports 是否正确。

- [ ] **Step 4: 验证产物可被消费**

确认 `packages/enterprise-contracts/package.json` 的 `exports`/`types` 指向 `vp pack` 产物，且类型能被 desktop 引用解析（`pnpm exec vp check` 或 `tsc` 在 contracts 的消费方不报缺类型）。

- [ ] **Step 5: 记录 H5 结论**

把判定（pass / partial / fail + 证据）追加进报告 `## H5`。

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "spike(H5): vp migrate + pack on enterprise-contracts"
```

---

## Task 2: H1 — desktop × electron-vite（头号关口）

**Files:**
- Modify: `../muon-viteplus-spike/apps/desktop/**`（vp migrate 产物）
- Append: 报告 `## H1` 小节

- [ ] **Step 1: 记录迁移前 desktop 的 dev/build 脚本**

```bash
cd ../muon-viteplus-spike
git --no-pager show HEAD:apps/desktop/package.json | grep -A2 '"dev"\|"build"'
```

Expected: 确认基线为 `electron-vite dev` / `pnpm type-check && electron-vite build`。

- [ ] **Step 2: 迁移后查看 desktop 脚本与 import 改写**

migrate 已在 Task 1 的根级执行覆盖全 workspace；查看 desktop 受影响处：

```bash
git --no-pager diff HEAD~1 -- apps/desktop | head -100
```

Expected: 看 `vite` → `vite-plus`、`vitest` → `vite-plus/test` 的改写，以及 dev/build 脚本是否被改。记录 electron-vite 是否仍被独立调用。

- [ ] **Step 3: 实测 dev（H1 关键）**

```bash
pnpm --filter @muon/desktop exec electron-vite dev &
# 或 vp 接管后的等价命令，以 Step 2 观察到的脚本为准
```

Expected（判据）：dev 服务器起得来、Electron 窗口打开、HMR 生效。卡死且约 30 分钟无解 → 止损。结束后 kill 进程。

- [ ] **Step 4: 实测 build（H1 关键）**

```bash
pnpm --filter @muon/desktop run build
ls -la apps/desktop/out
```

Expected（判据）：产出 `apps/desktop/out/**`（main.cjs / preload / renderer）。

- [ ] **Step 5: 判定与止损分支**

- 全通过 → H1 = pass。
- 任一失败且无解 → H1 = fail，**触发止损分支**：在报告中记「desktop 保留 electron-vite 原工具链，A 缩小为 api/contracts/rich-text/ui/admin 用 Vite+」。

- [ ] **Step 6: 记录 H1 结论并 Commit**

追加报告 `## H1`（含 dev/build 输出摘要、是否 pass、止损决定）。

```bash
git add -A && git commit -m "spike(H1): electron-vite x vite+ on desktop"
```

---

## Task 3: H2 — 测试链路（vp test）

**Files:** Append 报告 `## H2`

- [ ] **Step 1: 基线通过率**

```bash
cd ../muon-viteplus-spike
pnpm --filter @muon/desktop exec vitest run 2>&1 | tail -20
```

Expected: 记录基线 passed/failed 数。

- [ ] **Step 2: 用 vp test 跑同一套件**

```bash
pnpm exec vp help test
pnpm --filter @muon/desktop exec vp test 2>&1 | tail -30
```

Expected（判据 H2）：通过率 ≥ 基线；无「msw / jsdom / @vue/test-utils 配置不兼容」导致的整体失败。逐项记录任何新失败。

- [ ] **Step 3: 记录 H2 结论并 Commit**

```bash
git add -A && git commit -m "spike(H2): vp test on desktop suite"
```

---

## Task 4: H3 — .vue 类型检查（tsgo vs vue-tsc）

**Files:** Append 报告 `## H3`

- [ ] **Step 1: 基线 vue-tsc**

```bash
cd ../muon-viteplus-spike
pnpm --filter @muon/desktop exec vue-tsc --noEmit 2>&1 | tail -20
```

Expected: 记录基线类型错误数（理想为 0）。

- [ ] **Step 2: 用 vp check 的类型检查**

```bash
pnpm exec vp help check
pnpm --filter @muon/desktop exec vp check 2>&1 | tail -40
```

Expected（判据 H3）：判断 tsgo 是否解析 `.vue`。典型负面信号：`.vue` 被忽略、或对 SFC 内 `<script setup>` 报「无法解析模块」。

- [ ] **Step 3: 记录结论 + 兜底建议**

追加报告 `## H3`：tsgo 对 SFC 的覆盖结论 + 兜底方案（保留 `vue-tsc --noEmit` 作为 `.vue` 类型门，或评估实验性 `vue-tsgo`）。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "spike(H3): tsgo vs vue-tsc on .vue"
```

---

## Task 5: H4 — oxlint 对 Vue 的覆盖度

**Files:** Append 报告 `## H4`

- [ ] **Step 1: 基线 eslint 结果**

```bash
cd ../muon-viteplus-spike
pnpm --filter @muon/desktop exec eslint . 2>&1 | tail -30
```

Expected: 记录现有 `@antfu/eslint-config` 报告的问题数与规则分布（尤其 `vue/*`）。

- [ ] **Step 2: oxlint 结果**

```bash
pnpm exec vp help lint
pnpm --filter @muon/desktop exec vp lint 2>&1 | tail -30
```

Expected（判据 H4）：对比 oxlint 覆盖了哪些、漏了哪些 `vue/*` 与模板规则。量化缺口。

- [ ] **Step 3: 记录混合策略**

追加报告 `## H4`：建议「oxlint 管 JS/TS 正确性 + 保留 eslint（含 eslint-plugin-vue）管 vue 模板」的混合方案，列出无法被 oxlint 替代的规则类别。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "spike(H4): oxlint vue coverage gap"
```

---

## Task 6: H6 + 顺带 — vp run 编排 + Storybook

**Files:** Append 报告 `## H6` 与 `## 顺带观察`

- [ ] **Step 1: 用 vp run 复现根编排**

```bash
cd ../muon-viteplus-spike
pnpm exec vp help run
pnpm exec vp run build 2>&1 | tail -30
```

Expected（判据 H6）：能按 workspace 依赖顺序编排 build/test/lint，缓存命中（二次运行更快）。对比根 `package.json` 现有 `pnpm --filter` 串行脚本。记录是否可替代。

- [ ] **Step 2: 二次运行验证缓存**

```bash
pnpm exec vp run build 2>&1 | tail -10
```

Expected: 出现缓存命中标识、耗时显著下降。

- [ ] **Step 3: 顺带验 Storybook（ui 包）**

```bash
pnpm --filter @muon/ui exec storybook dev -p 6007 --ci &
```

Expected: Storybook 8.6 在 Vite+ 环境能起。记录成功/报错。结束后 kill 进程。

- [ ] **Step 4: 记录结论并 Commit**

追加报告 `## H6` 与 `## 顺带观察`（含 oxfmt vs prettier 差异面的简评，可选跑 `pnpm exec vp fmt --check` 观察改动量）。

```bash
git add -A && git commit -m "spike(H6): vp run orchestration + storybook"
```

---

## Task 7: 汇总报告 + 清理

**Files:**
- Finalize: `/Users/shikun/Developer/opensource/muon/docs/superpowers/specs/2026-06-07-viteplus-spike-report.md`

- [ ] **Step 1: 写最终判定**

在报告顶部写 **go / no-go / 缩小版 go** 的明确结论，依据 H1（致命）为主、H2/H3 次之。

- [ ] **Step 2: 若 go，写 A 全量迁移形态**

在报告写：哪些命令换 `vp`、哪些保留 `vue-tsc` / eslint-vue 兜底、混合 lint 策略、根脚本与 catalog/CI 的改动点、分阶段建议。

- [ ] **Step 3: 确认零并入 main**

确认 main 工作树除 `docs/superpowers/specs/2026-06-07-viteplus-spike-report.md` 外无工具链变更。

- [ ] **Step 4: 清理 worktree**

```bash
cd /Users/shikun/Developer/opensource/muon
git worktree remove ../muon-viteplus-spike --force
git branch -D spike/viteplus
```

Expected: worktree 与实验分支移除，实验产物全部丢弃。

- [ ] **Step 5: 交回结论**

向用户汇报 go/no-go 与下一步（若 go → 启动 sub-project A 的正式迁移计划；若缩小版 go → A 范围调整；若 no-go → 转向 B/C 等不依赖 Vite+ 的 sub-project）。报告是否要 commit 由用户决定（当前在 main，commit 前先开分支）。

---

## Self-Review

- **Spec coverage**：H1–H6 + 顺带项（Storybook / oxfmt）各有对应 task；隔离策略（worktree + 项目级依赖）见 Task 0；产出报告见 Task 7；止损规则见执行须知与 Task 2 Step 5 —— 全覆盖。
- **Placeholder scan**：无 TBD/TODO；命令与判据均具体。alpha 不确定处统一用「先 `vp help` 确认真实命令面」处理，是有意的探查步骤而非占位符。
- **一致性**：报告路径、worktree 路径、分支名 `spike/viteplus` 全文一致；假设编号 H1–H6 与 spec 一致。
