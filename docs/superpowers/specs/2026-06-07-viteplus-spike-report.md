# Vite+ 可行性 Spike — 报告（进行中）

- **日期**：2026-06-07
- **实测版本**：`vite-plus` 0.1.24 / `vp` 0.1.24（npm latest，2026-06-01 发布）
- **隔离**：worktree `.claude/worktrees/viteplus-spike`（分支 `worktree-viteplus-spike`），项目级 `pnpm add -D vite-plus`，零全局安装
- **关联**：spec `2026-06-07-viteplus-spike-design.md` / plan `plans/2026-06-07-viteplus-spike.md`

## 最终判定：⚠️ 有条件 GO（选择性采纳，非全量替换）

| 假设 | 结果 |
|---|---|
| H1 electron-vite 兼容 | ✅ PASS（共存，build 无破坏） |
| H2 vp test | ✅ PASS（1501/1502，唯一失败是 catalog 元测试） |
| H3 tsgo 对 .vue | ❌ 不支持（必须保留 vue-tsc） |
| H4 oxlint vue 覆盖 | ⚠️ 净降级（无 template/排序/风格规则，需混合 eslint） |
| H5 vp pack | ✅ PASS（ESM + DTS） |
| H6 vp run / oxfmt | ⚠️ 编排可用、缓存需配置；oxfmt TS 零差异 |

**核心判断**：Vite+ 能在本项目跑，但它替代 eslint/vue-tsc 的两大卖点对 **Vue 重型项目当前都打折扣**（oxlint 缺 vue 模板规则、tsgo 不认 SFC）。所以不是「一键全家桶替换」，而是「挑成熟的部分用，Vue 相关保留现状」。

### 分档建议

**✅ 建议采纳（低风险高收益）**
- `vp pack` → packages 库构建（**sub-project D 可直接落地**）
- `vp fmt`（oxfmt）→ 替代 prettier（TS 零差异、快 30×）
- `vp test`（Vitest）→ 可替代 `vitest run`（完全兼容）
- electron-vite 共存 → desktop 构建不受影响

**⚠️ 保留现状（Vite+ 当前不够）**
- `vue-tsc` → `.vue` 类型检查（tsgo 不认 SFC）
- `eslint` + `eslint-plugin-vue` → vue 模板/import 排序/风格规则；oxlint 作 JS/TS correctness 快速补充（**混合 lint，关 typeAware**）

**🔧 采纳前必做**
- 修 migrate 配置 bug（`top-level` → `prefer-top-level`）
- `vite-plus` 加入 catalog
- 评估 alpha 稳定性（大输出 panic）——生产前需谨慎或等更稳版本

### 对 5 个 sub-project 规划的影响

- **A（Vite+ 全量迁移）**：不建议无条件全量；降级为「选择性采纳」（fmt/pack/test 上，lint/typecheck 保留 eslint/vue-tsc）。
- **D（packages 库构建）**：✅ 用 `vp pack` 落地，可提前优先做。
- **B / C / E**：不依赖 Vite+，独立推进。

**下一步建议**：先做 **D（`vp pack` 给 packages）** 作为 Vite+ 首个低风险落地点；`vp fmt`/`vp test` 按需采纳；lint/typecheck 待 Vite+ 的 Vue 支持成熟再评估。

> 本报告基于隔离 worktree 实测，**零工具链变更并入 main**；worktree 在交付后移除。

---

## migrate 行为实测

命令：`vp migrate --no-interactive --no-hooks --no-agent --no-editor`（root 级）。

migrate 是**非侵入式**的——只替换 lint/format，不碰构建/测试/类型链路：

| 方面 | 改动 |
|---|---|
| 根 `package.json` scripts | `lint`/`format` → `vp lint`/`vp fmt`；卸载 `@antfu/eslint-config`、`eslint`、`prettier`、`eslint-config-prettier` |
| desktop scripts | 仅 `lint` → `vp lint`；**`dev`=electron-vite dev、`build`=electron-vite build、`type-check`=vue-tsc、`test:unit`=vitest run 全部原样保留** |
| 新增 `vite.config.ts`（root） | 承载 `lint`（oxlint）+ `fmt`（oxfmt）配置 |
| 删除 | `eslint.config.js`、`.prettierrc.json` |
| 源码 | 4 处 `// eslint-disable` → `// oxlint-disable`（正确） |
| lockfile | 移除 ~2259 行 eslint/prettier 生态依赖 |

**关键警告**：migrate 剥离了 `@antfu/eslint-config` 内部捆绑、但非顶层依赖的插件：`perfectionist`、`@stylistic`、`unused-imports`、`eslint-comments`、`command`、`regexp`、`jsonc`、`yml`、`toml`、`markdown`、`antfu`、`e18e`、`pnpm`。这些规则在生成的 oxlint 配置中缺失。

## H5 — `vp pack` 打纯 TS 包 ✅ PASS

命令：`vp pack src/index.ts --dts`（在 `packages/enterprise-contracts`）。

产物：`dist/index.mjs`（7.28 kB）+ `dist/index.d.mts`（12.86 kB），737ms，基于 tsdown/rolldown。ESM + 完整 DTS。

**结论**：纯 TS 源码包可用 `vp pack` 打成真正的 library 产物（sub-project D 可行）。注意产物为 `.mjs`/`.d.mts`，采用时需把 `package.json` 的 `exports` 从 `./src/index.ts` 指向 `dist`。

## H1 — electron-vite × Vite+ 兼容 ✅ PASS（头号关口）

命令：`electron-vite build`（在装了 vite-plus 的 workspace）。

结果：`✓ built in 2.54s`，产出完整 `out/main/main.cjs` + `out/preload/preload.cjs` + `out/renderer/index.html` + 全部页面 chunk（13 个 feishu app 均在）。唯一警告为 lottie-web 的 direct-eval（第三方库既存问题，与 vite-plus 无关）。

**结论**：migrate 不接管 electron-vite，二者**共存**——desktop 继续用 `electron-vite`（内部仍是真实 vite 8），Vite+ 负责 lint/format（及可选 test）。构建管线无破坏。

> dev（`electron-vite dev`）未单独实测：会在本机弹出真实 Electron 窗口、且 macOS 无 `timeout` 不便限时；build 已充分证明管线兼容，HMR 可后续手动验证。

## H2 — `vp test` 测试链路 ✅ PASS

命令：`vp test run`（在 `apps/desktop`，基于 `@voidzero-dev/vite-plus-test`，即 vitest）。

结果：**1501 passed / 1 failed（共 1502）**，wall-clock 48.25s。正确加载 desktop 的 `vitest.config.ts`，msw + jsdom + @vue/test-utils 全部正常（含组件测试，jsdom environment 起得来）。

唯一失败 = `tests/unit/monorepoScripts.test.ts`「keeps external dependency versions in the default pnpm catalog」——这是**项目自身的元测试**，断言所有依赖必须用 `catalog:`；失败原因是 spike 临时 `pnpm add -D vite-plus@^0.1.24` 未走 catalog，**与 vp/vitest 兼容性无关**。正式迁移时把 `vite-plus` 加入 `pnpm-workspace.yaml` 的 catalog 即可消除。

**结论**：vp test 与现有 vitest 配置/测试链路完全兼容。

## H3 — tsgo 对 `.vue` 类型检查 ❌（不支持）

命令：`vp check --no-fmt --no-lint`（type-check via tsgo / type-aware oxlint）。

结果：tsgo 对所有 `.vue` import 报 `TS2307: Cannot find module '…/X.vue' or its corresponding type declarations`（ImageMessage.vue、ShareDialog.vue 等）。tsgo（TS7）原生不理解 SFC，把 `.vue` 当未知模块。

**结论**：不能用 `vp check` 的 tsgo 替代 `.vue` 类型检查；**必须保留 `vue-tsc --noEmit`**（或实验性 `vue-tsgo`）作为 `.vue` 类型门。migrate 默认就保守保留了 vue-tsc。

**附带（alpha 稳定性）**：错误量大时 vite-plus 自身 rust panic（`SIGABRT … failed printing to stdout: Resource temporarily unavailable`）——0.1.24 的 bug。

**另一个 migrate bug**：生成的 `vite.config.ts` 把 `import/consistent-type-specifier-style` 写成 `"top-level"`（oxlint 期望 `"prefer-top-level"`），导致 lint/type-check 开箱无法启动，需手动改一字。

## H4 — oxlint 对 Vue 覆盖度 ⚠️（净降级，需混合方案）

命令：`vp lint`（修复配置 bug 后）。输出 1340 行，exit 1。

**配置层**（生成的 `vite.config.ts`）：oxlint 保留约 25 条 `vue/*` **script correctness** 规则（生命周期/define 宏/deprecated API），但**无任何 template 规则**（缩进/属性换行/命名/自闭合等）；丢失 `perfectionist`（import 排序）、`@stylistic`、`unused-imports`、`regexp`、`jsonc/yml/toml/markdown` 等。

**实跑**：
- 无 `vue/*` 告警（正常代码不违反那些 correctness 规则）。
- type-aware 规则**生效且是亮点**：`no-floating-promises`、`no-base-to-string`、`unbound-method`、`no-redundant-type-constituents`。
- 但启用 `typeAware/typeCheck` 时，因 tsgo 不认 `.vue`，测试/ts 文件里的 `.vue` import 全报 `TS2307` 噪音——当前 type-aware lint 在本 Vue 项目不实用，除非关 typeCheck 或解决 `.vue` 解析。

**结论**：直接迁移 = lint 能力**净下降**（丢 import 排序/风格/vue 模板规则）。现实策略为**混合**：oxlint 跑 JS/TS correctness（type-aware 谨慎或关闭），**保留 eslint + eslint-plugin-vue** 跑 vue 模板/排序/风格规则；oxfmt 接管格式化覆盖部分风格。

## H6 — `vp run` 编排 + Storybook（顺带）⚠️ 编排可用 / 缓存需配置

命令：`vp run build --filter @muon/enterprise-contracts`（跑两次）。

- **编排** ✅：`vp run` 支持 pnpm 风格 `--filter` / `--recursive` / `--transitive` / `pkg#task`，可替代根 `pnpm --filter` 脚本。
- **缓存** ⚠️：两次均 `0/5 cache hit (0%)`。migrate 未生成 task 的 inputs/outputs 声明，vp 无法判定 cacheable。缓存机制存在但需额外配置才能命中。
- **oxfmt vs prettier** ✅：`vp fmt --check` 在 contracts 4 文件 0 差异（169ms）——oxfmt 与原 prettier 输出在 TS 上一致，迁移成本低。`.vue` 的 oxfmt 行为未单独验。
- **Storybook**：未实跑。Vite+ 不接管 Storybook（`@storybook/vue3-vite` 走自有 vite，migrate 未碰 ui 包）；已知 Storybook 8.6 + Vite 8 dev 可用、build 坏（既存）。

---

## 附带发现汇总

1. **migrate 非侵入**：只换 lint/format，electron-vite / vue-tsc / vitest 全保留。
2. **migrate bug A**：生成配置 `import/consistent-type-specifier-style: "top-level"` 无效（应 `"prefer-top-level"`），lint/check 开箱即坏，需手动改。
3. **migrate bug B**：剥离 `@antfu/eslint-config` 捆绑的插件（perfectionist/@stylistic/unused-imports/regexp/jsonc/yml/toml/markdown…），lint 覆盖缩水。
4. **alpha 稳定性**：错误量大时 vite-plus rust panic（`SIGABRT`）。
5. **catalog**：spike 临时装的 `vite-plus` 未入 catalog，触发项目元测试失败；正式采纳需加入 `pnpm-workspace.yaml` catalog。
