# Packages TS Project References 实施计划（sub-project D）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 `enterprise-contracts`/`rich-text` 加 `composite` 生成 `dist/*.d.ts`，desktop + api 用 `references` + `tsc -b`/`vue-tsc -b` 做类型检查（解耦 + 增量），运行时 vite alias 不动。

**Architecture:** 两端解耦——类型端 `tsc -b`/`vue-tsc -b` + references → 包 `dist/*.d.ts`；运行时端 vite `alias` → 包 `src/*`（完全不动，HMR 零影响）。

**Tech Stack:** TypeScript project references（composite + `emitDeclarationOnly`）、`vue-tsc 3.2.7 -b`、pnpm workspace。

**关联 spec:** `docs/superpowers/specs/2026-06-07-packages-project-references-design.md`

---

## 执行须知

- 这是 TS 配置改造，非 TDD。每个 task = 改文件 → 跑命令验证 → commit。
- **运行时（vite/electron-vite alias）一行不改**；只改 tsc/vue-tsc 端。
- 报告路径（main 工作树）：`/Users/shikun/Developer/opensource/muon/docs/superpowers/specs/2026-06-07-packages-project-references-report.md`。
- 在隔离 worktree 内实施；验证全绿后再决定合并（spec 非目标：不发布、不动 admin）。

## File Structure

| 路径 | 改动 |
|---|---|
| `packages/enterprise-contracts/tsconfig.json` | 加 composite/emitDeclarationOnly/outDir |
| `packages/enterprise-contracts/package.json` | `build: tsc -b`；exports 加 types 条件 |
| `packages/rich-text/tsconfig.json` | 加 composite/emitDeclarationOnly/outDir |
| `packages/rich-text/package.json` | `build: vue-tsc -b`；6 个 exports 加 types 条件 |
| `apps/desktop/tsconfig.json` | 加 references、删 `@muon` paths；type-check 改 `vue-tsc -b` |
| `apps/api/tsconfig.json` | 加 references；`build: tsc -b` |
| `.gitignore` | `packages/*/dist/`、`**/*.tsbuildinfo` |
| `package.json`（根） | `build:contracts`/`build:rich-text` 走包内 `-b` |

---

## Task 0: 隔离 worktree + 基线量化

- [ ] **Step 1: 用 using-git-worktrees skill 建 worktree**

REQUIRED SUB-SKILL: invoke `superpowers:using-git-worktrees`（native `EnterWorktree`，名 `d-project-refs`）。

- [ ] **Step 2: 安装依赖**

Run: `pnpm install`
Expected: exit 0。

- [ ] **Step 3: 量化类型检查基线**

Run（记录耗时，跑两次取第二次）：
```bash
cd apps/desktop && for i in 1 2; do /usr/bin/time -p pnpm exec vue-tsc --noEmit 2>&1 | tail -4; done
```
Expected: 记录 `real` 秒数到报告「基线」。这是 D 加速对比的锚点。

---

## Task 1: 验证 rich-text `.vue` composite（R1 关键先验）

**Files:** `packages/rich-text/tsconfig.json`（临时改）

- [ ] **Step 1: 临时给 rich-text 加 composite 跑 vue-tsc -b**

把 `packages/rich-text/tsconfig.json` 改为：
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "emitDeclarationOnly": true,
    "noEmit": false,
    "outDir": "dist",
    "rootDir": "src",
    "ignoreDeprecations": "6.0"
  },
  "include": ["src/**/*.ts", "src/**/*.vue"]
}
```

- [ ] **Step 2: 生成 .d.ts 并检查 .vue 声明**

Run:
```bash
cd packages/rich-text && pnpm exec vue-tsc -b --force && find dist -name '*.d.ts*' | sort
```
Expected（判据 R1）：`dist/` 含 `index.d.ts`、`editor/useRichTextEditor.d.ts`、`htmlSanitizer.d.ts`、`linkify.d.ts`、`markdown.d.ts`，以及 **`components/RichMessageContent.vue.d.ts`**（确认确切文件名——后续 exports 要用它）。

- [ ] **Step 3: 确认 .vue.d.ts 含组件类型**

Run: `cat packages/rich-text/dist/components/RichMessageContent.vue.d.ts`
Expected: 含 `DefineComponent`/默认导出的组件类型声明。

**若 Step 2/3 失败**（vue-tsc -b 不支持 SFC composite，或不产 `.vue.d.ts`）：STOP，在报告记录现象，按 spec R1 缓解——rich-text 退回源码包，D 只对 contracts 做 references（跳过 Task 3，Task 4 references 只留 contracts、保留 desktop 的 rich-text paths）。

- [ ] **Step 4: 记录确切 .d.ts 文件名到报告**，供 Task 3 的 exports 使用。

---

## Task 2: contracts composite + exports

**Files:** `packages/enterprise-contracts/tsconfig.json`、`packages/enterprise-contracts/package.json`

- [ ] **Step 1: 改 contracts tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "emitDeclarationOnly": true,
    "noEmit": false,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 2: 改 contracts package.json 的 build + exports**

`scripts.build`: `"tsc --noEmit --project tsconfig.json"` → `"tsc -b"`
`exports`:
```json
"exports": {
  ".": { "types": "./dist/index.d.ts", "import": "./src/index.ts" }
},
```
（保留 `"main": "src/index.ts"`）

- [ ] **Step 3: 生成并验证 .d.ts**

Run: `cd packages/enterprise-contracts && pnpm exec tsc -b --force && ls dist`
Expected: `dist/index.d.ts` + `dist/tsconfig.tsbuildinfo`。

- [ ] **Step 4: Commit**

```bash
git add packages/enterprise-contracts && git commit -m "build(contracts): TS project references (composite + dts)"
```

---

## Task 3: rich-text composite + exports

> 依赖 Task 1 验证通过。Task 1 已把 tsconfig 改好；本 task 完成 package.json。

**Files:** `packages/rich-text/package.json`

- [ ] **Step 1: 改 rich-text package.json 的 build + exports**

`scripts.build`: `"vue-tsc --noEmit --project tsconfig.json"` → `"vue-tsc -b"`
`exports`（types 用 Task 1 确认的确切文件名）：
```json
"exports": {
  ".": { "types": "./dist/index.d.ts", "import": "./src/index.ts" },
  "./editor": { "types": "./dist/editor/useRichTextEditor.d.ts", "import": "./src/editor/useRichTextEditor.ts" },
  "./html": { "types": "./dist/htmlSanitizer.d.ts", "import": "./src/htmlSanitizer.ts" },
  "./linkify": { "types": "./dist/linkify.d.ts", "import": "./src/linkify.ts" },
  "./markdown": { "types": "./dist/markdown.d.ts", "import": "./src/markdown.ts" },
  "./message-content": { "types": "./dist/components/RichMessageContent.vue.d.ts", "import": "./src/components/RichMessageContent.vue" }
}
```

- [ ] **Step 2: 验证**

Run: `cd packages/rich-text && pnpm exec vue-tsc -b --force && ls -R dist | head -20`
Expected: 全部子路径 `.d.ts` 就位。

- [ ] **Step 3: Commit**

```bash
git add packages/rich-text && git commit -m "build(rich-text): TS project references (composite + vue dts)"
```

---

## Task 4: desktop references + 删 @muon paths

**Files:** `apps/desktop/tsconfig.json`、`apps/desktop/package.json`

- [ ] **Step 1: 改 desktop tsconfig.json**

`compilerOptions.paths`：**删除** `@muon/enterprise-contracts` 与全部 `@muon/rich-text*` 条目，**保留** `@/*`、`@features/*`、`@shared/*`、`@matrix/*`。
文件末尾加：
```json
"references": [
  { "path": "../../packages/enterprise-contracts" },
  { "path": "../../packages/rich-text" }
]
```

- [ ] **Step 2: 改 desktop type-check 脚本**

`scripts.type-check`：`"vue-tsc --noEmit && tsc -p tsconfig.electron.json --noEmit && tsc -p tsconfig.node.json --noEmit"`
→ `"vue-tsc -b && tsc -p tsconfig.electron.json --noEmit && tsc -p tsconfig.node.json --noEmit"`

- [ ] **Step 3: 验证类型检查（走 .d.ts）**

Run: `cd apps/desktop && pnpm exec vue-tsc -b`
Expected: 通过（0 error）。`@muon/rich-text/message-content` 等通过 exports.types 解析到 `dist/*.d.ts`。若报 `Cannot find module '@muon/...'`，检查包 exports.types 路径与 Task 1/2/3 产物是否一致。

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/tsconfig.json apps/desktop/package.json && git commit -m "build(desktop): use project references for @muon packages"
```

---

## Task 5: api references

**Files:** `apps/api/tsconfig.json`、`apps/api/package.json`

- [ ] **Step 1: 改 api tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": { "types": ["node"] },
  "references": [{ "path": "../../packages/enterprise-contracts" }],
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 2: 改 api build 脚本**

`scripts.build`：`"tsc --noEmit --project tsconfig.json"` → `"tsc -b"`

- [ ] **Step 3: 验证**

Run: `cd apps/api && pnpm exec tsc -b`
Expected: 通过（0 error），contracts 类型走 `dist/index.d.ts`。

- [ ] **Step 4: Commit**

```bash
git add apps/api && git commit -m "build(api): use project references for contracts"
```

---

## Task 6: gitignore + 根 build 脚本

**Files:** `.gitignore`、`package.json`（根）

- [ ] **Step 1: 追加 .gitignore**

```
packages/*/dist/
**/*.tsbuildinfo
```

- [ ] **Step 2: 确认根 build 脚本**

`build:contracts` / `build:rich-text` 已透传到包内 `build`（现为 `-b`），无需改命令；确认 `pnpm build` 顺序 contracts → rich-text → api → desktop 仍成立。

- [ ] **Step 3: Commit**

```bash
git add .gitignore package.json && git commit -m "chore: ignore dts build artifacts"
```

---

## Task 7: 全面验证

**Files:** 报告

- [ ] **Step 1: 类型检查加速对比**

Run:
```bash
cd apps/desktop
rm -rf ../../packages/*/dist ../../packages/*/*.tsbuildinfo
/usr/bin/time -p pnpm exec vue-tsc -b 2>&1 | tail -4   # 冷启（含依赖编译）
echo "// touch" >> src/main.ts && /usr/bin/time -p pnpm exec vue-tsc -b 2>&1 | tail -4   # 增量
git checkout src/main.ts
```
Expected: 增量明显快于 Task 0 基线（改 desktop 不重编译包源码）。记录三个数（基线 / 冷启 / 增量）到报告。

- [ ] **Step 2: 运行时不破坏**

Run: `cd apps/desktop && pnpm exec electron-vite build 2>&1 | tail -8 && ls out`
Expected: 产出 `out/main`+`out/preload`+`out/renderer`（vite alias 不动，与 spike 一致）。

- [ ] **Step 3: consumer 不破坏**

Run:
```bash
cd apps/api && pnpm exec tsc -b && echo "api OK"
cd ../admin && pnpm build 2>&1 | tail -5 && echo "admin OK"
```
Expected: 均通过。

- [ ] **Step 4: 全测试**

Run: `cd apps/desktop && pnpm exec vitest run 2>&1 | tail -8`
Expected: 通过率 = 改造前（注意 `monorepoScripts` 元测试此处应通过，因无 vite-plus 非 catalog 依赖）。

- [ ] **Step 5: 写报告并判定**

报告含：基线/冷启/增量三数、加速结论、运行时/consumer/测试结果、R1（.vue composite）结论。若加速不显著，据实记录、以解耦为交付。

---

## Task 8: 收尾

- [ ] **Step 1:** 用 `superpowers:finishing-a-development-branch` 决定合并方式（PR / 合并 / 保留）。
- [ ] **Step 2:** 向用户交回加速数据 + 是否进入下一个 sub-project（B/C/E）。

---

## Self-Review

- **Spec coverage**：改造清单 6 项 → Task 2-6；api 纳入 → Task 5；admin 不动（无对应 task，正确）；验证（基线/增量/运行时/consumer/测试）→ Task 0 + Task 7；R1 风险 → Task 1 先验 + 失败缓解分支。全覆盖。
- **Placeholder scan**：tsconfig/exports/命令均为确切内容；`.vue.d.ts` 文件名在 Task 1 确认后用于 Task 3（已标注依赖）。无 TBD。
- **一致性**：包名、路径、`references` 目标、exports `types`/`import` 条件顺序全文一致；type-check 命令 desktop=`vue-tsc -b`、api=`tsc -b` 一致。
