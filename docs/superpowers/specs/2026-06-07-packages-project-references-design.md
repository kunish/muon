# Packages TS Project References — 设计（sub-project D）

- **日期**：2026-06-07
- **状态**：设计待 review
- **所属**：Vite+ 全家桶迁移的 sub-project D（「给 packages 加库构建」经 spike 修正为「TS project references 做类型解耦/加速」）
- **来源**：`2026-06-07-viteplus-spike-report.md`（结论：目标是类型检查时，references 比打包更合适）

## 背景与动机

**动机**（用户选定）：类型检查**加速 / 解耦**——让 desktop（及 api）用预构建 `.d.ts`，不再把包源码当自己的代码一起编译。

**现状**：
- `enterprise-contracts`（纯 TS / zod）、`rich-text`（含 1 个 `.vue` + tiptap）是 monorepo 内部源码包，`exports` 指向 `src/*`。
- desktop 通过 **tsconfig `paths`** 与 **vite `resolve.alias`** 两套机制各自硬编码 `@muon/* → src`。`vue-tsc --noEmit` 因此把包源码纳入 desktop 的编译程序（耦合点）。
- desktop 已设 `skipLibCheck: true` → 改用 `.d.ts` 后会跳过对包声明的检查，确有加速空间。

**决定性发现**：desktop 运行时**只靠 vite `resolve.alias`**（electron.vite.config L90-99 / vite.config L30-39），**无 `vite-tsconfig-paths` 插件**。即「运行时 resolve」与「类型 resolve」完全独立 → 只改 tsc 端、不碰 vite alias 即可，**运行时与 HMR 零风险**。

## 目标 / 非目标

**目标**：contracts/rich-text 加 `composite`，生成 `dist/*.d.ts`；desktop + api 用 `references` + `tsc -b`/`vue-tsc -b` 做类型检查（走 `.d.ts`，增量缓存）。

**非目标（YAGNI）**：不打包 JS（运行时保留 src + HMR）；不改任何 vite/electron-vite alias；admin 不动；不发布 npm。

## 架构（两端解耦）

- **类型端**：`tsc -b` / `vue-tsc -b` + `references` → 包 `dist/*.d.ts`
- **运行时端**：vite `alias` → 包 `src/*`（**完全不动**）

## 改造清单

| # | 改动 | 细节 |
|---|---|---|
| 1 | contracts 加 composite | tsconfig 设 `composite/declaration/emitDeclarationOnly: true` + `outDir: dist` + `rootDir: src`（override 根 `noEmit: true`）。build = `tsc -b` |
| 2 | rich-text 加 composite | 同上，build = `vue-tsc -b`（为 `RichMessageContent.vue` 生成 `.vue.d.ts`） |
| 3 | 包 exports 加 types 条件 | `{ "types": "./dist/….d.ts", "import": "./src/…" }`（types 在前给 tsc；import 给 api tsx runtime）。rich-text 的全部 6 个子路径同样处理 |
| 4 | desktop tsconfig | 引用 @muon 的 tsconfig 加 `references`，**删该文件里的 `@muon` paths**；type-check `vue-tsc --noEmit` → `vue-tsc -b` |
| 5 | api 纳入 | api tsconfig 加 `references: [contracts]`；`build`(`tsc --noEmit`) → `tsc -b` |
| 6 | gitignore | `packages/*/dist/`、`**/*.tsbuildinfo` |

## 范围

- **改**：`enterprise-contracts`、`rich-text`（composite）；`desktop`、`api`（references）
- **不改**：`admin`（无 tsconfig、不 type-check、vite alias 硬指 src）；所有 vite/electron-vite alias

## 验证

1. **基线量化**（改造前）：desktop `vue-tsc --noEmit` 冷启耗时。
2. **改造后对比**：`vue-tsc -b` 冷启（含依赖编译）+ **增量**（改 desktop 不改包，应大幅快于冷启）。
3. **运行时不破坏**：`electron-vite build`（vite alias 不动，预期与 spike 一致产出 `out/`）。
4. **consumer 不破坏**：api `tsc -b` 通过；admin `vite build` 通过。
5. **全测试**：`vitest run` 通过率 = 基线。

## 风险与缓解

- **R1（主要）rich-text 的 `.vue` composite**：`vue-tsc 3.2.7` 的 `-b` 能否为含 SFC 的 composite 项目生成可被 desktop 消费的 `.d.ts`。→ **plan 第一步先单独验证**；若不可行：rich-text 退回源码包（D 只对 contracts 做 references），或评估 `vue-tsc --emitDeclarationOnly` 非 build 模式。
- **R2** composite 约束：`rootDir`/`include` 须完整覆盖，且包 tsconfig 要 override 根 `noEmit`。
- **R3** exports 条件顺序：`types` 必须在 `import` 之前。
- **R4** desktop 三 tsconfig（renderer/electron/node）：references 只加在实际 import `@muon` 的那个（plan 时精确探查；预期主要是 renderer `tsconfig.json`）。
- **R5** 增量陈旧：改包 API 后需重建 `.d.ts`；`-b` 模式自动按 references 顺序处理。

## 收益预期（诚实）

两个包体量小，**绝对加速可能有限**；主要价值是**解耦**——明确类型边界 + 增量缓存 + consumer 不再重编译包内部。验证第 1 步量化；若加速不显著，以「解耦 / 边界清晰 / 增量基础设施」为主要交付，并据实记录。
