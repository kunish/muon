# Feishu-Aligned Design System: Foundation & Atoms

**Date**: 2026-05-07
**Status**: Draft (umbrella spec + Spec 1 detailed)
**Sub-project ID**: `F0-design-system`
**Author / brainstorm partner**: shikun + Claude
**Parent goal**: 「所有功能对齐飞书」 — 11 个工作区模块全功能闭环

## §0 与既有 spec 的关系

「对齐飞书」在 muon 中已经经历过 3 轮 spec：

| 既有 spec | 角色 | 与本 spec 的关系 |
| --- | --- | --- |
| `2026-04-01-feishu-redesign.md` | Discord → 飞书 整体视觉与布局转向 | 已落地。本 spec 继承其信息架构，**但工程层面把样式从 app 抽离到独立 design system 包**。 |
| `2026-04-29-feishu-workspace-redesign-design.md` | Workspace app-first 重构、token 初版 | 已落地。本 spec 在其 token 基础上扩出第一层「palette」并形式化角色色映射。 |
| `2026-04-29-feishu-ui-interaction-polish-design.md` | `workspace-*` 共享样式类下放 | 已落地。本 spec 把 `workspace-*` 暂保留原位，约定在 Spec 3 阶段迁回 `@muon/ui`。 |

**本 spec 不重复以上工作**。它做三件前面没做的事：

1. 把样式工程化抽离为独立 design system 包（`@muon/ui` 升级而非新建）
2. 引入 Storybook 作为唯一交付物与验收基准
3. 给 F0-design-system 订一份 umbrella roadmap，把 Full design system 拆成 4 个串行子 spec

**已知冲突已标注**：

- 04-01 spec 提议主色 `#3370FF`；实际落地 `#2d5af7`。本 spec 取**现实落地值** `brand-500 = #2d5af7`，作为 muon 品牌身份保留项。

## §1 总纲：F0-design-system 子项目划分

`F0-design-system` 在 Atomic Design 自底向上路线下展开为 **1 个 umbrella + 4 个子 spec**。每个子 spec 完成后再走自己的 brainstorm → plan → 实施循环。

```
F0-design-system (umbrella, 本文档)
│
├─ Spec 1 — Foundation & Atoms          ✅ 落地 (本文档)
│   Tokens (color/typography/spacing/shadow/radius/density/motion)
│   Atom: button, input, textarea, badge, avatar, icon,
│         separator, kbd, spinner, switch, checkbox, radio
│   Storybook 脚手架 + 视觉回归基线 + 锚点视图协议
│
├─ Spec 2 — Molecules                    ✅ 落地 (2026-05-12)
│   form-field, menu-item, list-item, tooltip, popover, tabs,
│   breadcrumb, search-box, dropdown, segmented-control,
│   color-swatch, file-chip
│   详见 2026-05-12-feishu-design-system-molecules-design.md
│
├─ Spec 3 — Organisms                    (后续 brainstorm)
│   dialog, drawer, command-palette, empty-state, toast-center,
│   data-table, tree, page-header, side-panel, top-bar,
│   context-menu
│   含: 把 src/app/main.css 中的 workspace-* 迁回此层
│
└─ Spec 4 — Templates & Visual Assets    (后续 brainstorm)
    page-shell variants, error/empty 插画体系, loading patterns,
    brand asset pipeline, icon set 选型 + override 规则
```

### 子 spec 之间的契约

1. **Token 在 Spec 1 冻结后，后续子 spec 不可新增「角色色」**——只能新增「语义别名」。这是单一来源原则。
2. **所有子 spec 以 Storybook 故事作为唯一交付物**。被 muon app 消费是后续动作，不计入 design system 完成度。
3. **每个子 spec 必须附「参考调样卡」**——5-8 张飞书风的标的视图（用户提供），所有调样过程对照之比对。

### 边界（什么不属于 F0-design-system）

- 业务页面布局——属于各模块自己的 sub-project（messages parity / docs / calendar 等）
- 路由与导航逻辑——属于 `F0-shell-ia`（独立 sub-project）
- i18n 文案与多语字体策略——独立 sub-project；本 spec 仅在 typography token 中预留接口
- `apps/admin`（React 子应用）——本 spec 当前只服务 Vue 栈

## §2 架构与包结构

### 2.1 核心决策

**不新建独立包。把 `@muon/ui` 升级为 muon design system。**

依据：`@muon/ui` 已含 25 个 shadcn-vue 组件、完整 Tailwind v4 token、暗色覆盖。新建包会带来不必要的迁移成本与双源风险。

### 2.2 包结构演化

```
packages/ui/
├─ src/
│   ├─ tokens/                          ← 新增：拆分 token 文件
│   │   ├─ colors.css                   ← palette + role + dark
│   │   ├─ typography.css               ← font stack + 字号阶 + 行高
│   │   ├─ spacing.css                  ← 4-8 节奏间距阶
│   │   ├─ radius.css                   ← 保守圆角阶
│   │   ├─ shadow.css                   ← 克制阴影阶
│   │   ├─ density.css                  ← 控件高度 + 列表行高
│   │   └─ motion.css                   ← 缓动曲线 + 持续时间
│   ├─ atoms/                           ← 新增：原子组件（Spec 1）
│   │   ├─ button/, input/, textarea/, badge/, avatar/, icon/
│   │   ├─ separator/, kbd/, spinner/, switch/, checkbox/, radio/
│   ├─ molecules/                       ← Spec 2 占位
│   ├─ organisms/                       ← Spec 3 占位（含 workspace-* 迁入）
│   ├─ templates/                       ← Spec 4 占位
│   ├─ components/ui/                   ← 现有 shadcn-vue 组件，保留 export 路径
│   └─ styles.css                       ← @import tokens + 各层样式
├─ stories/                             ← 新增：Storybook 故事
└─ .storybook/                          ← 新增：独立 Storybook 配置 + anchors/
```

### 2.3 渐进迁移策略

- 现有 `src/components/ui/*` **不删**，`exports` 路径不变（外部 import 不变）
- 新建 `atoms/button/` 等 → 在 atom 层做飞书风重写
- 现有 `ui/button/` 内部 re-export 自 `atoms/button/`
- muon app 端代码**零改动**就能用上新样式，迁移压力 0

### 2.4 Storybook 接入

- 框架：**Storybook 9 + @storybook/vue3-vite**
- 配置位置：`packages/ui/.storybook/`
- 启动脚本：`pnpm --filter @muon/ui storybook`
- 故事组织：每个 atom 一个 `*.stories.ts`
- 锚点视图：`Reference/Anchors.stories.ts`，平铺用户提供的 5-8 张飞书参考截图，调样时左右开窗对照
- 部署：static build → GitHub Pages（可选；当前不阻塞 Spec 1）

### 2.5 与现有技术栈的关系

| 现有 | Spec 1 中的角色 |
| --- | --- |
| Tailwind CSS v4 | 保留——所有 token 通过 `@theme` 暴露 |
| shadcn-vue 复制式组件 | 保留底层文件结构，atom 层重写样式 |
| reka-ui（无头组件） | 保留作为 atom 行为底座（accessibility 由它负责） |
| lucide-vue-next | 保留作为 base icon set；Spec 4 决定是否扩展 muon 自有 icon |
| tw-animate-css | 保留作为动效库；本 spec 规范哪些 keyframe 进 design system |
| `workspace-*`（src/app/main.css） | 暂保留原位；Spec 3 迁回 organisms/ |

### 2.6 Build 与消费

- 包不预编译——以 source `.vue` + `.css` 形式 export（Vite 项目天然支持）
- 消费方（`apps/desktop`、`apps/admin` Vue 部分、`apps/web`）import `@muon/ui/styles.css`
- `exports` 字段维持每个 atom 独立 path，tree-shaking 友好

### 2.7 这一节明确**不**做

- 新建 npm 发布流程
- 替换 reka-ui / Tailwind / shadcn-vue
- 一次性重写所有现有 25 个组件——按需迁移
- 给 `apps/admin` React 子应用同步 token

## §3 Token 体系（Spec 1 详细）

Token 分两层：**palette layer（调色板）+ role layer（角色色）**。后者是前者的语义别名。muon 现状只有 role 层；Spec 1 关键升级是补出 palette 层。

### 3.1 Palette layer（新增）

每个色族 11 阶（50/100/200/.../900/950）。Spec 1 冻结 6 个色族。

| 色族 | 用途 | 锚定取色（500） |
| --- | --- | --- |
| `brand` | 主品牌（muon 身份保留） | `#2d5af7` |
| `gray` | 中性色（边框/文字/背景） | `#5F6673` 系，11 阶 |
| `red` | destructive / error | `#E54545` |
| `green` | success | `#00B42A` |
| `orange` | warning | `#FF7D00` |
| `cyan` | info / 链接备用 | `#0FC6C2` |

> 锚色基于公开飞书印象的近似值（除 brand 外，brand 取 muon 现值）。`tokens/colors.css` 顶部注释明确这一点。完整 11 阶值在实施 plan 阶段确定（用 `okhsl` 调色或 `tailwindcss-shade-generator` 等工具）。

### 3.2 Role layer（重映射现有）

| Role | 现值 | Spec 1 提议 | 备注 |
| --- | --- | --- | --- |
| `primary` | `#2d5af7` | `var(--brand-500)` | 主色 = brand-500 |
| `border` | `#e5e7eb` | `var(--gray-200)` | 边框统一 |
| `muted-foreground` | `#5f6673` | `var(--gray-500)` | 次要文字 |
| `destructive` | `#dc2626` | `var(--red-500)` | |
| `success` | `#059669` | `var(--green-500)` | |
| `warning` | `#d97706` | `var(--orange-500)` | |
| `accent` | `#e5e7eb` | `var(--gray-100)` | hover 浅底 |
| `sidebar` | `#f9fafb` | `var(--gray-50)` | |

### 3.3 暗色策略

飞书暗色非简单反色——背景层级用近黑灰阶，主色不降饱和。

```
亮色 background → 暗色 #17181C
亮色 card       → 暗色 #1F1F23
亮色 popover    → 暗色 #25262B
亮色 border     → 暗色 gray-700 透明 60%
```

冻结规则：暗色覆盖只允许重映射 role layer，不允许新增 role。

### 3.4 Typography

```
font-stack-sans:    'PingFang SC', 'HarmonyOS Sans SC', 'Source Han Sans SC',
                    'Helvetica Neue', Arial, system-ui, sans-serif
font-stack-mono:    'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace

字号阶（飞书偏小）：
  text-xs:   12px / 18px
  text-sm:   13px / 20px       ← 列表/控件主用字号
  text-base: 14px / 22px       ← 正文（从默认 16px 降下）
  text-lg:   16px / 24px       ← 卡片标题
  text-xl:   18px / 26px       ← 页面 H2
  text-2xl:  20px / 28px       ← 页面 H1
  text-3xl:  24px / 32px       ← marketing 用

font-weight: 400 / 500 / 600    ← 飞书几乎不用 700+
```

> **关键变更**：muon 当前 base 16px。降到 14px / 控件 13px 会影响所有页面密度，G6 烟雾测试覆盖此风险。

### 3.5 Spacing（4-8 节奏）

```
space-0.5: 2px    space-1: 4px    space-1.5: 6px
space-2:   8px    space-2.5: 10px space-3:   12px
space-4:   16px   space-5:   20px space-6:   24px
space-8:   32px   space-10:  40px space-12:  48px
```

list-item 内边距 `8px x 12px`（space-2 × space-3），drawer/dialog 边距 `space-5/space-6`。

### 3.6 Radius

```
radius-xs:   2px    ← 小标签/角标
radius-sm:   4px    ← 输入框/按钮（飞书主用）
radius-md:   6px    ← 卡片
radius-lg:   8px    ← dialog/drawer/popover
radius-xl:   12px   ← 头像组/特殊
radius-full: 9999px
```

> muon 现在 `--radius: 0.25rem (4px)` 单一值。Spec 1 扩展为完整阶。

### 3.7 Shadow

```
shadow-xs:  0 1px 2px 0 rgba(0,0,0,0.04)
shadow-sm:  0 2px 4px 0 rgba(0,0,0,0.06)
shadow-md:  0 4px 8px -1px rgba(0,0,0,0.08)     ← popover/dropdown
shadow-lg:  0 8px 24px -4px rgba(0,0,0,0.10)    ← dialog/drawer
shadow-xl:  仅特殊使用，需评审
```

不提供 `shadow-2xl`。

### 3.8 Density

```
control-h-sm: 28px    ← 紧凑按钮/输入
control-h-md: 32px    ← 默认（飞书 list-item 高度）
control-h-lg: 36px    ← 突出按钮
control-h-xl: 40px    ← form 主按钮

list-item-h:  32px
toolbar-h:    40px
sidebar-rail: 56px    ← muon 现值，对齐
```

### 3.9 Motion

```
duration-fast:    120ms    ← hover/focus
duration-base:    180ms    ← 多数 transition
duration-slow:    240ms    ← drawer/dialog
duration-slower:  320ms    ← page-level

ease-standard:    cubic-bezier(0.4, 0, 0.2, 1)
ease-emphasized:  cubic-bezier(0.2, 0, 0, 1)
ease-decelerate:  cubic-bezier(0, 0, 0.2, 1)
ease-accelerate:  cubic-bezier(0.4, 0, 1, 1)
```

### 3.10 冻结契约

Spec 1 完成后冻结。后续 Spec 2/3/4 不可改：

| 项 | 冻结 | 可变 |
| --- | --- | --- |
| 6 个色族 | ✓ | 单阶取值微调 |
| Role 名称 | ✓ | 新增需评审 |
| 字号阶 | ✓ | 新增需评审 |
| Spacing 阶 | ✓ | — |
| Radius / Shadow 取值 | ✓ | — |
| Motion 曲线集 | ✓ | — |
| 暗色覆盖规则 | ✓ | — |

## §4 Atom 组件清单与设计原则（Spec 1 详细）

### 4.1 原子组件清单

| Atom | muon 已有 | Spec 1 飞书化要点 | Variants（必备） |
| --- | --- | --- | --- |
| **button** | ✓ | radius=4、shadow=none、disabled=色阶位移、loading 内嵌 spinner、icon-only 28×28 | `default` / `primary` / `secondary` / `ghost` / `outline` / `destructive` / `link` |
| **input** | ✓ | 高度 32、border `gray-300`、focus 双 ring、placeholder `gray-400` | `default` / `error` / `success`，size `sm`/`md`/`lg` |
| **textarea** | ✓ | 同 input；可选 `auto-resize` | 同 input |
| **badge** | ✓ | radius=2、字号 12、字重 500、内边距 4×6 | `neutral` / `brand` / `success` / `warning` / `danger` / `info`，`solid`/`subtle`/`outline` |
| **avatar** | ✓ | radius=4 方形、首字母 fallback、状态点 8×8 偏右下 | sizes `xs(20)`/`sm(24)`/`md(32)`/`lg(40)`/`xl(56)` |
| **icon** | ✓（lucide） | 默认 16、stroke 1.5、`currentColor` | sizes `xs(12)`/`sm(14)`/`md(16)`/`lg(20)`/`xl(24)` |
| **separator** | ✓ | 1px `gray-200`，`inset` 变体（左缩进） | `horizontal` / `vertical` / `inset` |
| **kbd** | ✗ 新增 | `gray-100` 底 + `gray-700` 字 + 1px border + macOS 符号映射 | size `sm`/`md` |
| **spinner** | ✗ 新增 | 圆环 stroke 2，匀速 0.9s | sizes 同 icon |
| **switch** | ✓ | 28×16、滑块圆滑、`brand-500` 开 / `gray-300` 关 | sizes `sm`/`md` |
| **checkbox** | ✓ | radius=2、对勾 1.5 stroke、indeterminate 横杠 | sizes `sm`/`md` |
| **radio** | ✗（仅 reka-ui，无 muon 包装） | 16 外圈、内点 6 | sizes `sm`/`md` |

**清单外（不在 Spec 1）**：dialog、tooltip、popover、tabs、select、dropdown、card、alert、progress——分别归属 Spec 2 / Spec 3。

### 4.2 全局设计原则（Spec 1 冻结）

1. **Disabled = 色阶位移，非透明度降低**
   - 按钮：bg `brand-500` → `gray-200`，text `white` → `gray-400`
   - 输入：border `gray-300` → `gray-200`，bg → `gray-50`
   - 严禁 `opacity: 0.5` 一刀切
2. **Loading = 内嵌 spinner + disabled**
   - 按钮 loading 时 spinner 替换 leading icon 位置；保持宽度（invisible 占位）；禁用点击
3. **Focus ring 风格统一**
   - `outline: 2px solid var(--brand-500); outline-offset: 2px`
   - 不用 box-shadow 模拟 ring
4. **Density 默认 md，由父级 `data-density` 切换**
   - `<div data-density="compact">` 作用域内所有控件降一档
5. **状态色不允许混用**
   - destructive 永远 red，warning 永远 orange，禁止 yellow destructive
6. **不允许 inline style 指定颜色/间距/圆角/阴影**
   - 提议加自定义 ESLint rule（Spec 1 不强制；列入 §6 未决项）
7. **所有 atom 必须可被 `data-testid` 选中**
   - 命名约定：`{atom}-{variant}-{state}`
8. **国际化文案不进 atom**
   - atom 不调 `t()`；图标 `aria-label` 由消费方传入

### 4.3 飞书风视觉细节（5 条最易被忽略的）

1. 按钮 padding 默认 `8 × 16`（muon 现 `12 × 6` 偏紧）
2. Input border `gray-300` 比 button bg 略重，避免 input 像 button 弱影
3. Badge 字重 500 不是 400
4. Avatar 方形（radius-sm），仅头像组叠加用 radius-full
5. Switch 关态 `gray-300` 不是白

### 4.4 Storybook 故事约定

每个 atom 必须包含：

- `Default` — 默认 props
- `Variants` — 所有 variant 横向铺
- `Sizes` — 所有尺寸纵向铺
- `States` — hover / focus / disabled / loading
- `WithIcon` / `IconOnly`（适用于 button / badge）
- `Density` — 默认 vs compact 对比

命名空间：`Foundation/Atoms/{Name}`。

## §5 测试、验收与质量门

### 5.1 验收门（Spec 1 全部通过才能合并）

| 门 | 工具 | 通过标准 |
| --- | --- | --- |
| **G1 — Token 完备性** | grep + 自定义脚本 | 所有 token 均有定义、暗色覆盖、role 映射；无未引用 token |
| **G2 — Storybook 故事覆盖** | Storybook test-runner | 12 个 atom 均含 6 类故事 |
| **G3 — 锚点视图就位** | 人工 | 5-8 张参考截图入库到 `Reference/Anchors`（用户交付） |
| **G4 — 视觉回归基线** | Playwright screenshot | 所有 Storybook 故事截图入库为基线，CI 跑回归 |
| **G5 — 飞书风 checklist** | spec 附录（§7） | 30 条原则逐条人工勾过 |
| **G6 — 主 app 烟雾测试** | 手动 + Playwright | `apps/desktop` 启动后所有页面以截图对比为准；token 与字号变化引发的等比性变化（如 14px 正文、控件高度调整、颜色微差）不计为回归；功能性破损（重叠、溢出、不可点击）记为 P0 阻塞 |
| **G7 — 类型与构建** | `pnpm type-check && pnpm build` | 无新报错 |
| **G8 — 暗色模式** | 人工 + Playwright | 所有 atom 故事在暗色下截图 + 同样过 G5 |

### 5.2 锚点视图协议

- 用户提供 5-8 张图（推荐：飞书 IM 列表、文档 toolbar、日历周视图、审批表单、设置页——这些信息密度差异大）
- 入库路径：`packages/ui/.storybook/anchors/*.png`
- Storybook 故事 `Reference/Anchors` 用 `<img>` 平铺
- 所有调样 PR 必须附「对比截图」（左 anchor、右 muon）

### 5.3 视觉回归

- 复用 muon 现有 Playwright
- 命令：`pnpm --filter @muon/ui test:visual`
- 基线路径：`packages/ui/.storybook/__screenshots__/`
- 每故事一张图，差异 > 0.1% 报警

### 5.4 单元测试范围

只对以下行为做单测：

- `button` loading 状态（spinner 替换 icon、宽度保持）
- `switch` / `checkbox` / `radio` controlled / uncontrolled 双模式
- `kbd` macOS 与其他平台符号渲染（`⌘` vs `Ctrl`）

其余「组件外观」全部由视觉回归覆盖，不做单测。

## §6 风险、未决项与依赖

### 6.1 风险

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| Storybook 9 + Tailwind v4 兼容性 | 中 | Spec 1 第 1 天跑通 hello-world 故事验证；如失败回退 Storybook 8.x |
| Vite 8 + Storybook 9 | 中 | 需验证；如不兼容则用 Vite 7 跑 Storybook（与主仓不同版本） |
| 正文降到 14px 引发主 app 视觉回归 | 高 | G6 烟雾测试覆盖；fallback：用 `[data-density]` 渐进切换而非全局降字号 |
| lucide 图标风格与飞书细节差异 | 低 | Spec 1 接受现状；Spec 4 决定是否引入 muon 自有 icon set |
| `workspace-*` 与新 atom 风格冲突 | 中 | Spec 1 不动；Spec 3 迁回时统一调样 |

### 6.2 未决项（spec 写明 TODO 不立即决）

1. 品牌 logo 与 splash 是否对齐——Spec 4 处理
2. 是否给 admin React app 同步 token——后续单独评估
3. 30 条 checklist 最终版本——spec 1.0 给出草稿，第 1 周末敲定
4. 完整 11 阶 palette 取值——plan 阶段确定（用 okhsl 工具或类似）
5. 是否引入禁止 inline style 的自定义 ESLint rule——Spec 1 不强制

### 6.3 依赖

- 上游：无
- 下游：所有 phase 1+ 子项目都依赖 Spec 1 的 token 冻结

## §7 飞书风 checklist 草稿（30 条）

实施时勾选；Spec 1 验收门 G5 引用。

```
[ ] 全局：所有色彩走 role token，无 hex
[ ] 全局：所有圆角走 radius token
[ ] 全局：所有阴影走 shadow token
[ ] 全局：禁用 opacity 实现 disabled
[ ] Button: padding 8×16，icon-only 28×28
[ ] Button: loading 时 spinner 替换 leading icon 且宽度不变
[ ] Input: 高度 32px，focus 双层 ring
[ ] Input: placeholder gray-400，不允许斜体
[ ] Badge: radius=2px，font-weight=500，字号 12px
[ ] Avatar: 方形，radius-sm，状态点 8×8 偏右下
[ ] Avatar: 头像组叠加时用 radius-full
[ ] Icon: 默认 16px，stroke 1.5
[ ] Switch: 关态 gray-300，开态 brand-500
[ ] Checkbox: indeterminate 是横杠不是问号
[ ] Radio: 内点 6px
[ ] kbd: 两侧加 1.5px padding，单字符也居中
[ ] Spinner: 圆环 stroke 2，匀速旋转 0.9s
[ ] 暗色：背景层级 #17181C / #1F1F23 / #25262B
[ ] 暗色：brand 不降饱和
[ ] 暗色：border 用透明 60% gray-700
[ ] 字体：Mac/iOS 优先 PingFang SC
[ ] 字体：mono 用 JetBrains Mono fallback Consolas
[ ] Motion: hover/focus 用 duration-fast (120ms)
[ ] Motion: drawer/dialog 用 duration-slow (240ms)
[ ] Density: data-density="compact" 全控件 -4px
[ ] Spacing: 列表 padding 8×12
[ ] Toolbar 高度 40px
[ ] List-item 高度 32px
[ ] Sidebar-rail 56px
[ ] 所有控件键盘可达 + 焦点环
```

## §8 后续 Spec 占位

以下 spec 在 Spec 1 完成后各自走 brainstorm → plan → 实施流程。本文档仅占位，不展开内容。

- **Spec 2 — Molecules**：`form-field`, `menu-item`, `list-item`, `tooltip`, `popover`, `tabs`, `breadcrumb`, `search-box`, `dropdown`, `segmented-control`, `color-swatch`, `file-chip`
- **Spec 3 — Organisms**：`dialog`, `drawer`, `command-palette`, `empty-state`, `toast-center`, `data-table`, `tree`, `page-header`, `side-panel`, `top-bar`, `context-menu`；含 `workspace-*` 迁回
- **Spec 4 — Templates & Visual Assets**：`page-shell` variants, error/empty 插画体系, loading patterns, brand asset pipeline, icon set 选型 + override 规则

## 附录 A — 总目标 roadmap（信息性）

`F0-design-system` 是「所有功能对齐飞书」总目标的第一个 sub-project。完整 roadmap：

```
Phase 0  Foundations
  F0-design-system    ← 本 spec
  F0-shell-ia         全局壳 + 全局搜索 + 全局通知中心
  F0-identity         用户卡片 / 头像 / 角色徽章 / 在线状态

Phase 1  人与组织
  P1-contacts
  P1-organization

Phase 2  沟通与时间
  P2-messages-parity
  P2-calendar
  P2-calls

Phase 3  内容与生产力
  P3-docs-doc
  P3-docs-sheet
  P3-docs-bitable
  P3-docs-wiki
  P3-workplace

Phase 4  流程与协同
  P4-email
  P4-approvals
  P4-projects
  P4-okr

Phase 5  全局
  P5-settings   （穿插式增量，不集中做）
```

每个 sub-project 单独走 spec → plan → 实施。
