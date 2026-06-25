# macOS 原生视觉改版（macOS-Native Redesign）设计

日期：2026-06-25
状态：📝 设计中（待实现）

## 背景

当前 UI 是一套**忠实的飞书克隆**：飞书蓝 `#3370ff`、飞书中性灰阶、整套 B/N/R/G/O 色阶（`packages/ui/src/tokens/colors.css`）。视觉上「一眼是抄飞书」，缺乏自身辨识度。

架构扫描（2026-06-25，详见附录）确认了三个有利前提，使「全 app 换皮」可行而非空想：

1. **Token 单一源 + 级联**：`packages/ui`（`@muon/ui`）是唯一设计源，两个 app 各只 `@import '@muon/ui/styles.css'` 一次（`apps/desktop/src/app/main.css:1`、`apps/admin/src/main.css:3`）。无 per-app Tailwind/postcss 配置，Tailwind v4 经 `@tailwindcss/vite` 接入；全仓 `@theme` 块只在 `packages/ui/src/tokens/{colors,typography,spacing,radius,shadow,density,motion}.css`。改 token 值经运行时 CSS 变量回流到两个 app，零下游重复。CI 守卫：`packages/ui/scripts/check-tokens.ts`。
2. **暗色渲染层已完整且 CI 强制**：`.dark` class 挂 `<html>`，`light|dark|system` 状态在 `settingsStore`（持久化 `muon_theme`，**默认 system**），`useTheme`（`apps/desktop/src/features/settings/composables/useTheme.ts`）已订阅 `prefers-color-scheme` 实时重放；`colors.css` 的 `.dark{}` 块（约 416–667 行）覆盖每个色阶 + 每个 `--color-*`，`check-tokens.ts:72-75` 对缺失暗色对直接 fail。
3. **运行时是纯 Electron**（非 electrobun）：主进程 `apps/desktop/electron/main.ts`、预加载 `apps/desktop/electron/preload.ts`。`2026-05-11-electrobun-runtime-migration` 未落地，仅残留一个死 CSS 类名 `electrobun-webkit-app-region-drag`。

## 目标

把全 app 的视觉语言从飞书克隆改为 **macOS 原生质感**：系统强调色、macOS 系统灰、SF 字体、克制阴影、毛玻璃（vibrancy）侧栏、安静统一标题栏、内嵌红绿灯、iMessage 风格聊天气泡。**目标是「一眼是 mac app，不是飞书」，不追求像素级还原 Messages。**

## 决策摘要（已与用户确认，锁定）

| 维度 | 决策 |
|---|---|
| 改版类型 | 视觉改版（外观换语言，非代码架构重构） |
| 方向 | macOS 原生质感（成熟设计语言） |
| 范围 | 全 app（**一份 spec = 基座 Foundation + 分波铺开 Rollout**；执行分阶段） |
| 亮/暗 | 亮+暗都做，默认跟随系统（渲染层已 90% 就绪，补原生侧） |
| 强调色 | **跟随系统强调色**（Electron 读系统 accent 注入 CSS 变量；fallback macOS 蓝 `#007aff`） |
| 消息布局 | **iMessage 气泡（左右分布）**：自己靠右系统色填充、别人靠左系统灰；`messageAlignment` 默认 `leftright` |

## 非目标（YAGNI 边界）

- ❌ **不重建组件库**——复用现有 atoms/molecules/components-ui，只重定向 token + 改热点。
- ❌ **不为 Windows/Linux chrome 做 mac 级打磨**——保持其当前能用即可（按平台分支，互不回退）。
- ❌ **不碰后端/mock 数据语义**——email 内联 mock 替换是另一件已知工作，本 spec 只做视觉（顺手清掉视觉相关的内联样式）。
- ❌ **暂不加「硬编码 hex/radius」lint 守卫**——随波手清足够；除非热点反复回潮再考虑。
- ❌ **不做拖拽/动画特效大改**——只把缓动换成 macOS 克制档。

## 架构

**一份 spec，两层结构。主杠杆是 token 级联，结构改动只集中在少数热点。**

```
① 基座 Foundation（全 app 共享，先做、先验收）
   ├─ §2.1 设计语言 token 层      packages/ui/src/tokens/*
   ├─ §2.2 原生外壳与窗口 chrome   electron/main.ts + WindowTitleBar.vue + shell
   ├─ §2.3 nativeTheme 桥 + 闪白   main.ts + preload + 启动骨架屏
   ├─ §2.4 Vibrancy 材质           新增 material token + 侧栏/rail 透明面
   └─ §2.5 聊天参考实现（试点）     features/chat —— 端到端验证基座

② 铺开 Rollout（基座验收通过后）
   └─ Wave 1–4：把基座套到 20+ 模块（先级联 → 点修热点 → 双主题 QA）
      §2.6 跨切面硬编码清理随波进行
```

解耦原则沿用现有：`packages/ui` 不反向依赖 app；语义角色层（`--color-*` 兼容层）是组件读取面，原始色阶（B/N/R/G/O）只在 token 内部互相引用。

## 详细设计

### §2.1 设计语言 token 层（`packages/ui/src/tokens/`）

全部改在 token，向下级联。亮/暗各一套（CI 强制暗色对）。

- **色彩**
  - 语义层 `--color-primary` / `--color-ring` / 选中态等重定向到**系统强调色**：由主进程读 OS accent（见 §2.3）经 CSS 变量 `--system-accent` 注入；token 引用它，fallback `#007aff`。
  - 中性灰阶（N00–N1000）从飞书灰换成 macOS 系统灰梯度；语义层（`--color-background/card/popover/sidebar/border/input/muted/accent`）随之。
  - `.dark{}` 块逐项补 macOS 暗色值，`check-tokens.ts` 继续把关。
- **圆角（`radius.css`）**：建 macOS 档——控件 `--radius-control:6px`、气泡 `--radius-bubble:17px`、卡片 `--radius-card:10–12px`、窗口 `--radius-window:10px`。散落的 `rounded-[20px]/[16px]/[10px]/[4px]` 收敛到这些 token（热点见 §2.6）。
- **字体（`typography.css`）**：`--font-sans` 用系统栈（`-apple-system, 'SF Pro Text', system-ui`）；新增大标题档 `--font-display`（`'SF Pro Display'`）+ macOS 行高/字距/光学字重。
- **密度（`density.css`）**：映到 macOS「舒适」档（控件高度、行距）。
- **阴影/材质（`shadow.css` + 新 material token）**：重阴影降到 macOS 克制档；新增 vibrancy/material 变量（§2.4）。
- **动效（`motion.css`）**：缓动换 macOS 弹性档。

### §2.2 原生外壳与窗口 chrome

需要动结构（主进程 + shell 组件）。**按 `process.platform === 'darwin'` 分支，不回退其它平台。**

- **`electron/main.ts` `createMainWindow()`（约 `:508-535`）**：mac 分支用 `titleBarStyle:'hiddenInset'`；mac 上**去掉** WCO `titleBarOverlay`（在 mac 是 no-op）；加 `vibrancy:'sidebar'` + `visualEffectState:'active'`；`backgroundColor` 随主题动态（消除暗色启动闪白，见 §2.3）；`roundedCorners:true`；`trafficLightPosition.y` 与真实标题栏高度联动。
- **`WindowTitleBar.vue`**：mac 安静标题栏——去掉居中品牌 logo+wordmark（`:31-41`，Win/Linux 习惯）；红绿灯预留宽（`--window-titlebar-mac-controls-width`，`:49/:85-88`）由真实高度推导，不再硬编码与 `trafficLightPosition` 重复；`flex:0 0 36px`（`:54`）与主进程 `height` 单一来源对齐；header 与标题栏统一为 unified toolbar。门控缝在 `App.vue:15-47`（`showWindowTitleBar`）。

### §2.3 nativeTheme 桥 + 系统强调色 + 启动闪白

补的是原生侧/首帧（渲染层已就绪）。

- **`nativeTheme` 桥**：新增 IPC（preload 暴露），`settingsStore.setTheme()` → 主进程 `nativeTheme.themeSource = light|dark|system`，让原生菜单/对话框（`main.ts:246-294`）/红绿灯跟随 app 主题。
- **系统强调色**：主进程读 OS accent（macOS：`systemPreferences.getAccentColor()`），经 IPC/注入提供 `--system-accent`；监听变化实时更新。fallback `#007aff`。
- **启动闪白**：`main.ts` `backgroundColor:'#ffffff'`（`:513`）改为按主题动态；`src/app/main.ts` 预挂载从 `localStorage('muon_theme')` 提前打 `.dark`；修打包产物启动骨架屏的暗色（确认实际打包的 `index.html`——源文件已含 `@media (prefers-color-scheme: dark)`，构建产物疑似 strip 成硬编码亮色 `#f6f7fb`）。

### §2.4 Vibrancy 材质（从零建——「macOS 灵魂」）

全 app 当前**无真 OS vibrancy**，只有 CSS `backdrop-blur` 在浮层（`NetworkStatusBar.vue:47`、`UserPanel.vue:33`、`MessageList.vue:729`、各 picker）。

- 主进程 `vibrancy:'sidebar'`（§2.2）提供 OS 毛玻璃底材。
- **app rail（`WorkspaceAppRail.vue`）+ 会话侧栏（`ChannelSidebar.vue`/`ConversationList.vue`）** 背景改半透明（透明 CSS 背景叠 OS vibrancy），新增 material token 控制透明度/saturate。
- 主内容区（`<main>`）保持不透明，符合 macOS「侧栏透、内容实」惯例。

### §2.5 聊天参考实现（试点，先打通端到端）

`apps/desktop/src/features/chat`。基座套到这里跑通 = 基座验收。活跃路径：`ChatPage → ChatWindow → MessageList → MessageGroup → ChatMessage`（live）+ `MessageActionBar`（live）+ `RichTextInput`（composer，Tiptap）。

- **气泡（`ChatMessage.vue:138-141`）**：裸 `rounded-[20px] px-4 py-2.5` + `bg-[var(--B100)]`/`bg-[var(--N200)]` 换成气泡 token：`--radius-bubble`、`--bubble-own-bg`=系统强调色（白字）、`--bubble-other-bg`=系统灰。应用点在 `:824`（HTML 分支）与 `:841`（纯文本）。
- **左右分布**：`messageAlignment` 默认设为 `leftright`（`MessageGroup.vue:193-198` 的 `grid-cols-[2.5rem_minmax(0,1fr)]` 右对齐翻转已支持），设置项保留。
- **周边**：头部（`ChatHeader.vue:151-152` `h-14 px-4 border-b bg-sidebar`）安静化；composer（`RichTextInput.vue` `:1382/:1472`）药丸化；悬浮动作条（`MessageActionBar.vue:291` `rounded-[10px]`）走圆角 token；rail 行选中条（`ConversationItem.vue:113-118` `w-[3px] bg-primary`）随强调色。
- **不动**：`NAME_COLORS` 每用户身份色（`ChatMessage.vue`/`ReplyReference.vue`）是有意脱离主题的，保留。

### §2.6 跨切面硬编码清理（随波进行，不单开工程）

token 换不动的硬编码，随对应模块的波次手清：

- 内联 `#hex`：`DocsFolderTree.vue:38` + `DocPreviewCard.vue:16`（手搓暗色 tooltip → 改用 popover 原语，不是重新上色）；`AppearanceSettings.vue:78-87`（主题预览色块）；`UserPopover.vue:162`/`MemberContextMenu.vue:185`/`UserInfoPanel.vue:241` 的内联 `rgba(0,0,0,…)` 阴影 → 阴影 token。
- 硬编码圆角：方角 server 控件 `rounded-[4px]`（`ServerSettings.vue:68`、`RoleManager.vue:207`、`MemberManager.vue:205`、`ChannelManager.vue:171`）→ 圆角 token；chat 内 `StickerPicker`/`MessageContextMenu`/`UserInfoPanel` 等散落圆角同理。

## 分波铺开计划（Rollout）

每波套路一致：**①级联（token 自动生效）→ ②点修该波热点（§2.6）→ ③亮/暗双主题视觉 QA**。模块组件数来自附录扫描。

- **Wave 1 · 锁语言**：外壳 chrome + app rail + `WorkspacePageFrame.vue` → **chat（75）** → **settings（12）**。macOS token（vibrancy、红绿灯内嵌、SF 字体、控件尺寸）在此定型。
- **Wave 2 · 高频真实**：server（22）→ contacts（8）→ calls（4，含 `CallWindow`/`CallOverlay` 原生浮窗打磨）→ docs（13）→ projects（14）。
- **Wave 3 · 本地真实**：calendar、tasks → email（顺手替换内联 mock 消息）→ approvals、workplace。
- **Wave 4 · 批量**：okr、minutes、bitable、survey、reports、attendance、rooms、announcements、mindmap、organization（10 个单组件 localStorage 页，基本纯级联 + 点修）。

## 验收门（Acceptance Gates）— 本节为 ground truth

> 设计描述（§2.x）与本节冲突时，**以本节为准**，并回头修正 §2.x。

**基座门（Foundation，须全过才进 Rollout）**

- **G1 级联生效**：改 token 后，未触碰的组件（取 chat 外任一 Wave-4 页）外观随之变化，无需改组件；`check-tokens.ts` 通过（亮/暗对齐全）。
- **G2 原生窗口**：mac 上窗口为 `hiddenInset` + 圆角 + `vibrancy:'sidebar'`；红绿灯位置与标题栏高度对齐；Win/Linux chrome 未回退（仍正常）。
- **G3 跟随系统**：切系统亮/暗，app 与原生菜单/对话框/红绿灯同步变（`nativeTheme.themeSource` 生效）；切系统强调色，按钮/自己气泡/选中态跟随；冷启动暗色**无白闪**。
- **G4 Vibrancy**：app rail 与会话侧栏为真 OS 毛玻璃（透出桌面），主内容区不透明。
- **G5 聊天试点**：`ChatMessage.vue` 无裸 `rounded-[20px]`/裸 `B100/N200`；气泡走 token；`messageAlignment` 默认 `leftright`，自己靠右=系统强调色、别人靠左=系统灰；亮/暗双主题截图均「macOS 感」。

**铺开门（每波收尾）**

- **G6/波**：该波模块在亮/暗双主题下视觉一致、无飞书蓝/飞书灰残留、无 §2.6 列出的硬编码遗留；该波涉及的散落圆角/内联 hex 已清。
- **G7 总收尾**：全仓 grep 无未级联的 `#3370ff`/`#245bdb` 等飞书 hex 内联（`NAME_COLORS` 等有意例外除外）；无 `rounded-[NNpx]` 散落（除明确保留项）。

## 测试

- **既有基建复用**：Storybook + Playwright 已渲染双主题——给聊天试点新增 macOS 视觉快照（亮/暗各一）。
- **token CI**：`check-tokens.ts` 继续强制亮/暗对齐。
- **手动验收**（对应 G2–G4）：红绿灯位置、vibrancy 透出、暗色冷启动不闪白、系统强调色/亮暗切换实时跟随。
- **回归**：Win/Linux 下窗口 chrome 与拖拽区仍正常（平台分支不互相影响）。

## 已知限制 / 风险

- **系统强调色读取**跨平台 API 不一（macOS `getAccentColor` 可用；Win 另路；Linux 多半 fallback）——非 mac 平台回退固定蓝，可接受。
- **`vibrancy` 与 `transparent`/`backgroundColor`** 在 Electron 不同版本/平台行为有差异，需在真机验证暗色不闪白与毛玻璃同时成立。
- **打包产物启动骨架屏**：须确认实际打包的 `index.html` 是哪份（源文件含暗色媒体查询，产物疑似被 strip）——是构建管线问题而非源码问题。
- **铺开工作量**：Wave 1 是真功夫（结构 + 试点）；Wave 2-4 大头是级联 + 点修，但 server/docs/projects/calls 组件多，QA 量不小。

## 附录：架构扫描发现（关键文件锚点）

来自 2026-06-25 并行架构扫描（6 路 reader + 综合，详 workflow `macos-redesign-ui-map`）。

**模块清单（component 数 / 真实性）**

| 模块 | 主界面 | #组件 | 真实/Mock |
|---|---|---|---|
| chat | ChatPage（列表+消息窗+输入+媒体+搜索） | 75 | 真实（Matrix，10 stores） |
| server | ServerList/ChannelSidebar/语音频道 | 22 | 真实（serverStore + LiveKit） |
| projects | ProjectDetail（List/Board/Gantt） | 14 | 真实（IndexedDB + TanStack） |
| docs | DocsPage（TipTap）+ 协同 | 13 | 真实（docsDb + Matrix 同步） |
| settings | profile/appearance/security/devices | 12 | 真实 |
| contacts | 列表/profile/groups | 8 | 真实 |
| calls | CallsPage/CallWindow/CallOverlay/视频块 | 4 | 真实（Matrix + LiveKit） |
| calendar/tasks | 月/周视图 · 看板 | 1 / 1 | 真实（localStorage） |
| approvals | 模板 + 决策流 | 1 | 真实-ish（apps/api 配置时；否则 contacts fallback） |
| email | 文件夹 + 阅读器 | 1 | 混合（内联 mock 种子 + 真实 SMTP/IMAP 桥） |
| workplace/bitable/okr/minutes/survey/rooms/attendance/announcements/reports/mindmap/organization | 各自单页 | 各 1 | Real-light（Pinia + localStorage，无后端） |
| auth | LoginPage | 1 | 真实（Matrix 登录） |

> 顶层 `pages/*.vue` 是 7 行壳，委托 feature 组件；无 `*.seed.ts`/`*.mock.ts`，残留 mock 为内联（如 `EmailPage.vue` 约 :132）。

**Shell 树**

```
App.vue（竖向：36px 标题栏 + <main> RouterView）
├─ WindowTitleBar.vue（自定义 36px 栏；Electron-only）
└─ AppLayout.vue（认证壳）
   └─ WorkspaceLayout.vue（横向：[rail | sidebar 槽 | main | overlays]）
      ├─ WorkspaceAppRail.vue（64px；pinned apps + 全部应用 popover）
      ├─ #message-sidebar → ChannelSidebar.vue → WorkspaceResizablePane.vue（220–360px 持久化）
      │     └─ ConversationList.vue / server 频道树
      ├─ <main> → RouterView（非 chat 页用 WorkspacePageFrame.vue）
      └─ #overlays → GlobalOverlayHost / CallOverlay / CallWindow / dialogs
```

**修正记录**：①运行时为纯 Electron（electrobun 仅死 CSS 类名）；②`MessageBubble.vue`/`MessageMoreMenu.vue` 已**删除**（非「死代码待验证」），全仓零 `.vue` 匹配。
