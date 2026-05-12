# Feishu-Aligned Design System: Molecules

**Date**: 2026-05-12
**Status**: Draft
**Sub-project ID**: `F0-design-system` / Spec 2
**Author / brainstorm partner**: shikun + Claude
**Parent goal**: 「所有功能对齐飞书」 — 11 个工作区模块全功能闭环
**Upstream**: `2026-05-07-feishu-design-system-foundation-design.md` (Spec 1 — Foundation & Atoms)

## §0 与 Spec 1 的关系

Spec 1 落地了 6 个色族 palette + 完整 role layer + 12 个 atom（button、input、textarea、badge、avatar、icon、separator、kbd、spinner、switch、checkbox、radio）+ Storybook 脚手架 + 锚点视图协议。

Spec 2 在此基础上做且仅做：

1. **新增 8 个 molecule**：form-field、menu-item、list-item、breadcrumb、search-box、segmented-control、color-swatch、file-chip。
2. **原位升级 4 个 shadcn 复合组件**：tooltip、popover、tabs、dropdown-menu（不复制到 molecules/，directly 改 styling 与 token 绑定）。
3. **不动 atom、不动 token palette**——仅允许新增"语义别名"（如 `--list-item-selected-bg`）。

**冻结契约继承**：色族、role 名称、字号阶、spacing 阶、radius / shadow 取值、motion 曲线、暗色覆盖规则——全部沿用 Spec 1，本 spec 无权改动。

## §1 总体架构与目录策略

### 1.1 目录划分

```
packages/ui/src/
├─ atoms/                          ← Spec 1 落地，冻结
├─ molecules/                      ← Spec 2 新增 8 个真正新建项
│   ├─ form-field/
│   ├─ menu-item/
│   ├─ list-item/
│   ├─ breadcrumb/
│   ├─ search-box/
│   ├─ segmented-control/
│   ├─ color-swatch/
│   └─ file-chip/
├─ components/ui/                  ← shadcn 原位升级
│   ├─ tooltip/                    ← Spec 2 调样
│   ├─ popover/                    ← Spec 2 调样
│   ├─ tabs/                       ← Spec 2 调样（部分已落地）
│   └─ dropdown-menu/              ← Spec 2 调样 + menu-item 注入
└─ stories/Molecules/              ← 12 个 *.stories.ts
```

### 1.2 Re-export 与 exports 契约

- 8 个新 molecule：`molecules/<name>/{Component.vue, index.ts}`；`package.json` 新增 8 条 exports 直指。
  ```jsonc
  "./form-field":         "./src/molecules/form-field/index.ts",
  "./menu-item":          "./src/molecules/menu-item/index.ts",
  "./list-item":          "./src/molecules/list-item/index.ts",
  "./breadcrumb":         "./src/molecules/breadcrumb/index.ts",
  "./search-box":         "./src/molecules/search-box/index.ts",
  "./segmented-control":  "./src/molecules/segmented-control/index.ts",
  "./color-swatch":       "./src/molecules/color-swatch/index.ts",
  "./file-chip":          "./src/molecules/file-chip/index.ts"
  ```
- 4 个 shadcn 原位升级项：路径与 exports 不变；CVA / token 直接改 `components/ui/<name>/*.vue`。

### 1.3 分层契约（Spec 1 已规定 + Spec 2 补充）

| 层 | 允许 | 禁止 |
| --- | --- | --- |
| atom | 单一职责、无内部组合 | 不引 molecule |
| molecule | 由 ≥2 atom 组合或承担多 slot 结构 | 不引 organism；不引业务 store；不调 `t()` |
| 业务页 | 引 molecule + organism | 不直接对 atom 加样式 override |

### 1.4 已有 shadcn 组件"原位升级"规则

- 只允许改：styling 类、cva variants、token 绑定、暗色覆盖。
- 允许：新增非破坏性 prop（如 popover 的 `size`，默认值匹配旧行为）。
- 不允许：改现有 props 名称 / 类型 / 默认值，改 emit 事件签名，改对外暴露的子组件名（如 `TooltipTrigger`）。
- a11y / focus 行为由 reka-ui 兜底，本 spec 不动。
- 升级前/升级后必须各跑一次 G6 烟雾测试，对比无功能性破损。

## §2 12 个 Molecule 设计要点

所有数值沿用 Spec 1 token；尺寸默认 `md`；密度默认 `default`，被 `[data-density="compact"]` 父级降一档。

### 2.1 form-field（新增）

**定位**：表单字段的布局与状态容器；不接管控件，控件由 slot 注入。

**结构**：
```vue
<FormField :label :required :description :error :orientation>
  <Input v-model="..." />            <!-- 默认 slot -->
  <template #helper>提示</template>   <!-- 可选 helper（被 error 覆盖时隐藏） -->
</FormField>
```

**关键设计**：
- 单根 `<div class="field">`，子元素垂直堆叠 6px 间隔
- Label：13px / line 20 / `gray-700` / weight 500；`*` required 2px gap、`destructive` 色
- Description：12px gray-500，紧邻 label 下方
- Control：slot，通过 `provide('fieldId', id)` 把自动生成 id 注入到 atom（Input/Textarea/Select），atom 端 inject 后绑 `aria-describedby`
- Helper / Error：12px，helper `gray-500` 与 error `destructive` 互斥渲染
- Horizontal 模式：label 左侧固定宽度 120px，control 右侧 flex

**Variants**: `orientation: vertical/horizontal`、`size: sm/md`

**Anchor**: `04-approval-form.png`

### 2.2 menu-item（新增）

**定位**：DropdownMenu / ContextMenu / Popover 内部的可点击行。

**关键设计**：
- 行高 32（与 list-item sm 一致），padding `0 10px`
- Leading icon 14×14（lucide stroke 1.5）+ 6px gap
- Label 13px gray-900 单行
- Trailing：可选 kbd atom（11px gray-500）或右箭头 (chevron-right 12 gray-400)
- Hover `bg-gray-50`（区别于 list-item 的 `bg-gray-100`）
- Selected `bg-gray-100`（含 ✓ leading）
- Destructive variant：text + leading icon `destructive` 色
- Disabled：色阶位移而非 opacity

**Variants**: `variant: default/destructive`、`hasIcon/hasKbd/hasArrow`

**Anchor**: 新增 `06-context-menu.png` (待用户交付，见 §6.2)

### 2.3 list-item（新增）

**定位**：独立列表中的一行——IM 会话列表、联系人、文件、Settings 导航等。

**关键设计**：
- Sizes：`sm 32` / `md 40` / `lg 48`；compact density 全部 -4
- Leading slot：avatar (md 用 sm 24、lg 用 md 32)、或 16 icon
- Body：两行栈 — title 13px gray-900 单行 truncate；meta 12px gray-500 单行 truncate
- Trailing slot：badge / unread count / chevron / 任意 atom
- Hover `bg-gray-100`、Selected `bg-gray-100` + 左侧 4px 色条 `bg-brand-500`（hover 与 selected 共享底色，由 4px rail 区分）
- 整行不能反白成 brand-500（飞书风约束）

**Variants**: `size: sm/md/lg`

**Anchor**: `01-messages.png`、`05-settings.png`

### 2.4 tooltip（原位升级 `components/ui/tooltip/`）

**关键设计**：
- 暗色 `bg-gray-900`、亮色 `bg-gray-800` 反色（飞书 theme-inverse 风格）
- 字号 12 / 行高 16 / 字重 400
- Padding `6 10`
- Radius `radius-sm` (4px)
- 箭头 4px
- Motion: `duration-fast` (120ms) / `ease-standard`

**Variants**: 无新增

**Anchor**: 复用任意——飞书 tooltip 全局一致

### 2.5 popover（原位升级 `components/ui/popover/`）

**关键设计**：
- Radius `radius-lg` (8) / shadow `shadow-md` / 内边距 12
- 背景：亮 `popover` token (白)、暗 `#25262B`
- 宽度档：`size: sm/md/lg` → 240 / 320 / 400px
- 默认 offset 8px

**Variants**: `size: sm/md/lg`（新增 prop）

**Anchor**: `03-calendar-week.png`

### 2.6 tabs（原位升级 `components/ui/tabs/`）

**关键设计**（在已有 segmented/underline 双 variant 基础上校准）：
- `underline` variant：高度 36、active indicator 2px `bg-brand-500` / 18px wide / 居中、inactive 字色 gray-500 active gray-900
- `segmented` variant：容器 32 高 / 4px 圆角 / bg gray-100；active `bg-card` + `shadow-xs`
- 两种 variant 字号统一 13、字重 active 500、inactive 400

**Variants**: `variant: segmented/underline`

**Anchor**: `04-approval-form.png`

### 2.7 breadcrumb（新增）

**定位**：Docs / Wiki / 多级导航的路径指示。

**关键设计**：
- 字号 12 或 13（响应式 `size`）/ gray-500
- 分隔符：lucide `chevron-right` 12 gray-300
- 当前项：gray-900 不可点击（无 hover、无 underline）
- 链接项 hover：色保持，underline-offset 4 underline-from-font
- 长路径中段省略 `…`，每段最大宽 200px 截断 + tooltip

**Variants**: `size: sm/md`、`truncation: middle/end`

**Anchor**: `02-docs-home.png`

### 2.8 search-box（新增）

**定位**：顶部全局搜索 / sidebar 内 IM/contact 搜索。

**关键设计**：
- 基于 Input atom 二次组合（不复制 Input 实现）
- Leading：lucide `search` 14、gray-500
- Trailing 1：`clear` icon 14（仅 input 有值时显示，hover gray-700 默认 gray-500）
- Trailing 2：可选 kbd atom（`⌘K` / `Ctrl+K`）
- 高度同 Input md (32)、sm (28)
- Focus 双层 ring 沿用 Input

**Variants**: `size: sm/md`、`hasKbd: true/false`

**Anchor**: `01-messages.png` 顶部搜索栏

### 2.9 dropdown (DropdownMenu，原位升级 `components/ui/dropdown-menu/`)

**关键设计**：
- 内部 item 样式由 menu-item molecule 接管（统一来源）
- 容器 `radius-lg` (8) / `shadow-md` / bg popover token
- 分组 label：11px / gray-500 / uppercase / tracking-wider / padding `6 10`
- Separator atom 替代内置 `<DropdownMenuSeparator />` 的样式
- 最小宽度 180、最大宽度 320

**Variants**: 无新增

**Anchor**: 头像菜单 / 文档操作菜单（任一）

### 2.10 segmented-control（新增）

**定位**：视图模式切换器——区别于 Tabs（切内容）。例：Settings → 视图密度、Calendar 月/周/日。

**关键设计**：
- 容器 32 高 / 4px 圆角 / `bg-gray-100`，内嵌项之间无 gap
- Active 项：`bg-card` + `shadow-xs` + text gray-900 weight 500
- Inactive：text gray-500 weight 400 hover gray-700
- 项内 padding `0 12`
- `inline` variant 容器透明，只显示 active 项底色

**Variants**: `size: sm/md`、`variant: default/inline`

**Anchor**: `05-settings.png` 顶部

### 2.11 color-swatch（新增）

**定位**：标签色 / Calendar 事件色 / Doc 高亮色 选择项。

**关键设计**：
- 尺寸 12 / 16 / 20（三档）
- Radius `radius-sm` (4)
- Selected：2px outline `brand-500`、`outline-offset 2px`
- 12 个预设色取自 palette：brand-500、red-500、orange-500、green-500、cyan-500、gray-500 + 同色 200 阶（共 12）
- Disabled：opacity 不允许；用 cross 覆盖示意

**Variants**: `size: sm/md/lg`、`selected: boolean`

**Anchor**: `03-calendar-week.png`（新增标签色锚点参考）

### 2.12 file-chip（新增）

**定位**：消息附件徽片 / Approval 表单附件 / Doc 内嵌附件。

**关键设计**：
- Sizes：`sm 24` / `md 32` 高度
- Leading：16 文件类型 icon（颜色按扩展名映射 — 见 §6.2 未决项 3）
- Label：13px gray-900 单行 truncate 至最大宽 200
- Optional size hint：11px gray-500 紧跟 label
- Trailing：`close` (removable) 或 `download` (downloadable) icon 14
- Radius `radius-md` (6)
- bg `gray-50`（区别于 badge 的 brand 系底色）
- Hover bg `gray-100`

**Variants**: `size: sm/md`、`removable: boolean`、`downloadable: boolean`

**Anchor**: 新增 `07-message-attachment.png` (待用户交付，见 §6.2)

## §3 测试与验收门

继承 Spec 1 的 G1–G8 八门，下面只列 Spec 2 增量。

### 3.1 G1 — Token 完备性（增量）

- 仅允许新增"语义别名"，禁止新 palette、禁止新 role。
- 本 spec 预计新增语义别名（具体值由 plan 阶段定）：
  - `--list-item-hover-bg: var(--color-gray-50)`
  - `--list-item-selected-bg: var(--color-gray-100)`
  - `--list-item-active-rail: var(--color-brand-500)`
  - `--menu-item-hover-bg: var(--color-gray-50)`
  - `--file-chip-bg: var(--color-gray-50)`
  - `--breadcrumb-current-color: var(--color-gray-900)`

### 3.2 G2 — Story 覆盖（增量）

每个 molecule 必须包含 6 类 story：

- `Default` — 默认 props
- `Variants` — 所有 variant 横向铺
- `Sizes` — 所有尺寸纵向铺
- `States` — hover / focus / disabled / selected
- `Density` — 默认 vs compact
- `Composed` — 在真实业务上下文中嵌入（form-field 嵌 Input、list-item 嵌入 Message 列表上下文、file-chip 在消息气泡里等）；**取代** atom 的 `WithIcon/IconOnly`

命名空间：`Molecules/{Name}`。

### 3.3 G3 — Anchor 视图（增量）

现有 5 张 + 新增 2 张：

| 文件 | 来源 | 用途 |
| --- | --- | --- |
| `06-context-menu.png` | 飞书桌面端任意右键菜单 | menu-item |
| `07-message-attachment.png` | 飞书 IM 消息含附件视图 | file-chip |

由用户交付，入库到 `packages/ui/.storybook/anchors/`，Storybook `Reference/Anchors` 故事自动展示。

### 3.4 G4 — 视觉回归（增量）

- 12 个 molecule × 6 类 story × 亮/暗双模 ≈ 144 张新基线截图
- PR 分批：8 个新 molecule 各自 1 PR（推荐顺序见 §5）；4 个 shadcn 升级合 1 PR
- 容差仍 0.1%

### 3.5 G5 — 飞书风 checklist（追加 8 条）

接续 Spec 1 §7 的 30 条：

```
[x] form-field: label-control 间距 6px，required * 与 label 间 2px
[x] form-field: error 出现时 helper 必须消失，不允许同时
[x] list-item: selected 用 4px 左色条 + bg-gray-100，不允许整行 brand-500 反白
[x] menu-item: 行高 32 与 list-item-sm 一致，但 hover 色 gray-50（区别 list-item gray-100）
[x] breadcrumb: 当前项不可点击，省略段用 "…" 单字符不用 "..."
[x] search-box: clear 仅在 input 有值时出现，不允许常驻
[x] segmented-control: active 态必有 shadow-xs，与 Tabs underline 视觉区分
[x] file-chip: 文件 icon 颜色按扩展名映射，固定 8 类 (doc/sheet/pdf/img/video/audio/zip/other)
```

### 3.6 G6 — 主 app 烟雾（重点页面）

- Settings（form-field、segmented-control、list-item 高密度）
- Approval form（form-field、tabs、segmented-control）
- Messages 列表（list-item、search-box、menu-item、file-chip）
- Docs Home（breadcrumb）
- 失败定义：功能性破损 (重叠 / 溢出 / 不可点) = P0 阻塞；视觉等比变化不计

### 3.7 G7 / G8

同 Spec 1，molecule 全量过类型检查 + 暗色 story。

## §4 风险

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 4 个 shadcn 组件"原位升级"破坏既有 import / API | 中 | 仅改 styling 与 cva，不动 props/emit/子组件名；G6 烟雾覆盖；升级前/升级后各跑一次基线对比 |
| `form-field` slot 模式让 a11y `aria-describedby` 关联易写错 | 中 | FieldShell `provide('fieldId', id)`；Spec 1 atom 端 inject 入口（Input/Textarea/Select 加 fieldId inject 兜底） |
| `list-item` 与 `workspace-*` 旧 CSS 类共存期视觉双源 | 中 | Spec 2 不动 `workspace-*`，Spec 3 organism 阶段统一迁回；本 spec 在 G2 Composed story 中显式标注共存上下文以便对比 |
| segmented-control 与 Tabs(segmented variant) 概念重叠引发误用 | 低 | spec 与 story 明文区分用途（Tabs 切内容、SegmentedControl 切模式）；G5 增 checklist 项 |
| 视觉基线增量 ~144 张提交体积膨胀 | 低 | 按 §5 分 PR 顺序提交；CI 缓存策略不变 |
| menu-item 在 DropdownMenu 内被注入引发 reka-ui slot 兼容问题 | 中 | plan 阶段第一天验证；如不兼容则改为"DropdownMenuItem 子组件直接继承 menu-item 样式 token"而非组件注入 |

## §5 提交顺序建议（plan 阶段细化）

按依赖与风险升序：

1. **search-box** — 复用 Input atom，最小新增风险，验证 molecule 目录脚手架
2. **breadcrumb** — 静态，无交互，验证 Storybook story 6 类模板
3. **segmented-control** — 自包含，验证与 Tabs 共存的命名区分
4. **color-swatch** — 极简，验证视觉回归基线截图流程
5. **file-chip** — 内含扩展名色映射，等 §6.2 未决项 3 决策
6. **list-item** — 高频，需先验证 IM 列表 G6 烟雾
7. **menu-item** — 依赖 list-item 已稳定（避免两者样式来回调整）
8. **form-field** — 引入 provide/inject 机制，最高架构影响，最后做

9. **tabs 原位校准**（已部分落地，最小成本）
10. **tooltip 原位校准**
11. **popover 原位校准**
12. **dropdown-menu 原位升级 + menu-item 注入** — 依赖 menu-item 完成

## §6 未决项与依赖

### 6.1 依赖

- **上游**：Spec 1 token 与 atom 冻结 — ✅ 已落地
- **下游**：Spec 3 (organism) 与 11 个工作区模块 feature spec

### 6.2 未决项

1. **新增 2 张 anchor 截图**：`06-context-menu.png`、`07-message-attachment.png` — 待用户从飞书桌面端截取交付，入库 `packages/ui/.storybook/anchors/`
2. **inline-style ESLint 规则** — Spec 1 §6.2 遗留；本 spec 仍不强制，留 Spec 3 决定
3. **file-chip 8 类扩展名色映射的具体取色** — plan 阶段定，候选：doc=blue / sheet=green / pdf=red / img=orange / video=purple / audio=cyan / zip=gray / other=gray-400（待 anchor 视图后定）
4. **`form-field` provide/inject 与现有 atom 的契约** — plan 第一天验证：Input/Textarea 的 reka-ui 内部 id 生成是否允许外部覆盖。如不允许，退化为消费方手动传 `id` prop
5. **menu-item 注入 DropdownMenu 的可行性** — plan 第一天用 hello-world story 验证；fallback 见 §4 风险表

## §7 这一节明确**不**做

- 不动 token palette、不动 role layer
- 不动 atom 实现
- 不迁移 `workspace-*` 类（留 Spec 3）
- 不引入 admin React 端
- 不发布 npm
- 不动 routing / i18n / store

## 附录 A — 与 umbrella roadmap 的对账

```
F0-design-system
├─ Spec 1 — Foundation & Atoms          ✅ 落地
├─ Spec 2 — Molecules                    ← 本文档
├─ Spec 3 — Organisms                    (后续 brainstorm)
└─ Spec 4 — Templates & Visual Assets    (后续 brainstorm)
```

Spec 2 完成后，进入 Spec 3 organism 阶段，把 `workspace-*` 类迁回 organism 层并加上 `dialog/drawer/command-palette/empty-state/toast-center/data-table/tree/page-header/side-panel/top-bar/context-menu` 等组件。
