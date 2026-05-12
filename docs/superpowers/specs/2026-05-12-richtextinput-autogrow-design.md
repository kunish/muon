# RichTextInput Auto-Grow

**Date**: 2026-05-12
**Status**: Draft
**Author / brainstorm partner**: shikun + Claude
**Scope**: 单组件行为调整（`src/features/chat/components/RichTextInput.vue`）

## §1 背景与动机

聊天富文本输入框（紧凑模式）当前固定为 `min-h-[40px] max-h-[40px]` + `overflow-hidden` + `[&_.tiptap]:whitespace-nowrap` + `[&_.tiptap_p]:truncate`。结果：

- 用户输入第 2 行内容时，第二行被截断、不可见。
- 想看见多行内容，唯一手段是点击「展开编辑器」按钮，但展开模式是完全不同的 UI（带标题字段、独立工具栏、独立发送按钮的「帖子模式」），并非用户的直觉期望。

期望行为：输入框默认仍是 40px 单行的紧凑视觉；输入第二行起，外框跟随内容自然长高；达到上限后改为内部滚动。**不引入新状态机、不引入 JS 监听**。

## §2 设计

### 2.1 受影响代码点

唯一改动点：`src/features/chat/components/RichTextInput.vue:121-129` 的 `editorHeightClass` computed。

```ts
const editorHeightClass = computed(() => {
  if (editorExpanded.value)
    return '...'           // §2.3 第 3 档，不变

  if (hasPendingPasteAttachments.value)
    return '...'           // §2.3 第 2 档，max 上限调整

  return '...'              // §2.3 第 1 档，去掉单行截断、上限放宽
})
```

### 2.2 三档模型对比

| 档位 | 触发 | 改动后含义 |
|---|---|---|
| **默认（紧凑）** | 既非展开、也无粘贴附件 | `min` 40px 保留紧凑视觉；`max` 提到 40vh；去掉 `overflow-hidden` / `whitespace-nowrap` / `truncate`，让 `.tiptap` 内容自然撑高；溢出走 `overflow-y-auto` |
| **粘贴附件** | `hasPendingPasteAttachments === true` | `min` 仍 80px（缩略图坑位），`max` 由 180px **统一抬到 40vh**，与默认档一致 |
| **已展开（帖子模式）** | `editorExpanded === true` | 不变（`min-h-[320px] max-h-[60vh]`） |

### 2.3 精确 class 变更

**默认档**：

| 旧 | 新 |
|---|---|
| `overflow-hidden` | `overflow-y-auto` |
| `min-h-[40px]` | `min-h-[40px]` *(同)* |
| `max-h-[40px]` | `max-h-[40vh]` |
| `[&_.tiptap]:min-h-[24px]` | `[&_.tiptap]:min-h-[24px]` *(同)* |
| `[&_.tiptap]:overflow-hidden` | *(移除)* |
| `[&_.tiptap]:whitespace-nowrap` | *(移除)* |
| `[&_.tiptap_p]:truncate` | *(移除)* |

最终：`overflow-y-auto min-h-[40px] max-h-[40vh] [&_.tiptap]:min-h-[24px]`

**粘贴附件档**：

| 旧 | 新 |
|---|---|
| `overflow-y-auto` | `overflow-y-auto` *(同)* |
| `min-h-[80px]` | `min-h-[80px]` *(同)* |
| `max-h-[180px]` | `max-h-[40vh]` |
| `[&_.tiptap]:min-h-[64px]` | `[&_.tiptap]:min-h-[64px]` *(同)* |
| `[&_.tiptap]:overflow-visible` | *(移除，原档位的反向覆盖现在不再需要)* |
| `[&_.tiptap]:whitespace-normal` | *(移除，同上)* |

最终：`overflow-y-auto min-h-[80px] max-h-[40vh] [&_.tiptap]:min-h-[64px]`

**展开档**：不变，仍为 `overflow-y-auto min-h-[320px] max-h-[60vh] [&_.tiptap]:min-h-[304px]`。

### 2.4 复用既有机制

- 动画过渡：`src/features/chat/components/RichTextInput.vue:975` 现有的 `transition-[max-height,min-height] duration-200` 直接命中，无需新增 CSS。
- 占位符样式、`is-editor-empty` 占位符、提及、列表样式等 `[&_.tiptap_*]` 修饰类，全部保留。
- `editorExpanded` ref、展开按钮、`submitOnEnter` 等逻辑不变。

### 2.5 滚动同步（追加于 G1–G4 手测发现）

落地紧凑档 auto-grow 后，G2/G3 暴露出两个"应该跟随滚动但没有"的隐性依赖：

**2.5.1 编辑器内部：光标跟随滚动**

当紧凑档内容超过 `max-h-[40vh]`、wrapper 切换到内部滚动后，连续 `Shift+Enter` 换行或长段文字会让 ProseMirror 的光标位置进入 wrapper viewport 下方不可见区。PM 默认会对 transaction 加 `scrollIntoView()` 标志，但在我们这种 wrapper 与 `view.dom` 隔一层、且光标位于新插入的最后一行时，浏览器实际滚动行为不够稳定。

**修法**：在 `src/features/chat/components/RichTextInput.vue` 中，对从 `useRichTextEditor` 拿到的 `editor` ShallowRef 加 `update` 订阅，每次 doc 变更后调用 `editor.commands.scrollIntoView()` 强制将光标位置滚入可视区。该 command 派发一个 no-op transaction（doc/selection 不变，只置 scrollIntoView flag），不会重新触发 `update` 事件、不会和 `useRichTextEditor` 内部的其他事务冲突。

订阅必须在 `editor` 被解析为非 undefined 后挂上，并在组件卸载时 `editor.off('update', ...)` 清理（Tiptap 的 `useEditor` 会在卸载时整体销毁 editor，事件订阅天然失效；显式清理更稳）。

**为什么不放进 `@muon/rich-text` package**：该 package 是跨场景共享的（聊天、`DocEditor` 等），是否需要 caret-into-view 取决于宿主 wrapper 是否有自己的滚动容器——这是 RichTextInput 的特有需求，应在调用方装配。

**2.5.2 消息列表：长高时保持底部锚定**

`ChatWindow.vue:48-59` 布局为 `<div class="flex flex-col h-full"> { MessageList(flex-1 overflow-auto) + TypingIndicator + RichTextInput } </div>`。当 RichTextInput 长高（40px → 432px），作为 flex 兄弟的 MessageList `clientHeight` 被 flex 挤短；若用户原本停在底部（`isAtBottom === true`），新的 viewport 顶部不变、底部上移，结果"最后一条消息被输入框压出可视区"。

`MessageList.vue:629-678` 已有完整的"粘底"机制：`onChildResize()` 内的 `if (isAtBottom.value) alignToBottom()` 是现成入口。问题在于 `setupResizeObserver()` 只对**容器子元素**（消息气泡）`observe`，没有 observe 容器自身——所以"容器被 flex 兄弟挤短"这件事不触发 callback。

**修法**：在 `MessageList.vue` 的 `setupResizeObserver()` 内，紧挨着 `for (const child of el.children) resizeObs.observe(child)` 后追加一行 `resizeObs.observe(el)`。容器自身的 `contentBoxSize` 变化即可命中 `onChildResize`，复用现有的 `isAtBottom → alignToBottom()` 分支，无新逻辑。

**为什么不监听 RichTextInput 的高度变化反向通知 MessageList**：跨组件 ref 耦合代价大；ResizeObserver 在容器上观察自身是同一现象的更本地化检测，且 `onChildResize` 已对 `pendingRestore` / `isPaginating` / `userInteracting` 做了完整闸门，不会产生额外回归风险。

### 2.6 Compact composer 重排为 flex-col（追加于 G7/G8 手测发现）

§2.1 - §2.5 落地后，G2/G3 暴露了**第三个**未在原 spec 范围内的视觉缺陷：

**现象**：compact-composer 当前是 `flex items-center gap-0 rounded-lg bg-input` 三列布局——左 `+`（h-10）/ 中 editor (`flex-1`, 可达 `max-h-[40vh]` ≈ 444px) / 右工具栏 (h-10)。当 editor 撑到 444px 时，左右两列仍是 40px 的按钮、但 `items-center` 把它们落在垂直中线，于是按钮上下各空出 ~200px 的 `bg-input` 灰底——视觉上像"容器多出一块空白区"。

**为什么 `items-end` 不能修**：等效于把空白从下面挪到上面，总空白量不变。

**修法**：把 compact-composer 从三列水平布局改为两行垂直布局——

- **顶部**：editor 区（含原有可折叠格式栏 Transition + EditorContent）。仍使用 §2.3 的 `editorHeightClass`（紧凑/粘贴附件/展开三档不变）。
- **底部**：统一的 action row（`h-10 shrink-0` + `items-center justify-between`），左侧放 `AttachmentMenu`（即原 `+` 按钮）、右侧保留原右栏所有按钮（`@` / `Aa` / `GIF` / 展开 / 麦克风）。`expressionTriggerRef` 仍挂在右侧按钮组上。
- **容器**：仍是 `rounded-lg bg-input`，但 `flex-col`，不再 `items-center`。

**对其它部分的影响**：
- `editorHeightClass` 不变（§2.3 三档保持）。
- `editor.on('update')` 滚动同步（§2.5.1）不变。
- MessageList 容器自观察（§2.5.2）不变。
- 帖子模式（expanded-composer）不变。
- `data-testid="compact-composer"` 保留在新外层 div 上，子项 `data-testid` 不变。

**对 G1 的影响（重要）**：原 G1「空状态下输入框视觉与改前一致（40px 单行紧凑）」**不再成立**——新布局空状态 ≈ 80px（editor 40px + action row 40px）。这是已接受的取舍（视觉债换布局清洁）。G1 在 §4 中相应修订。

**为什么不分情况切换 row/col**：基于 editor 行数动态切换布局会在多行/单行边界出现跳变 + transition 重启，对用户感知差。统一 flex-col 是更稳的状态机。

## §3 影响面

### 3.1 测试

- **必改**：`tests/components/RichTextInput.expand.test.ts:106-113` 的默认档断言。
  - 移除断言：`toContain('max-h-[40px]')` / `toContain('[&_.tiptap]:whitespace-nowrap')` / `toContain('[&_.tiptap_p]:truncate')` / `not.toContain('overflow-y-auto')`。
  - 新增断言：`toContain('overflow-y-auto')` / `toContain('max-h-[40vh]')` / `not.toContain('overflow-hidden')` / `not.toContain('whitespace-nowrap')` / `not.toContain('truncate')`。
  - 保留断言：`toContain('min-h-[40px]')`（min 没变）、`toContain('[&_.tiptap]:min-h-[24px]')`（内层 min 也没变）。
  - 第 122 行 `expect(expandedEditor.classes()).not.toContain('min-h-[40px]')` 保持不变（展开后 min 是 320px，仍成立）。
- **不动**：该文件第 2、3 个用例（"展开布局"、"展开发送"）不受影响。
- **视觉快照**：最近 commit `d38ec06 test(ui): baseline visual snapshots for Spec 2 molecules` 引入的快照若覆盖紧凑态 RichTextInput，需重新基线化；这是预期变化，不是回归。
- **§2.5 滚动同步部分**：行为依赖真实浏览器/Electron 渲染（caret coords、flex 引起的容器 resize），jsdom 难以复现；主要靠 G7/G8 手测。可补一个轻量单元测试断言 `MessageList` 的 ResizeObserver 也观察了容器自身（间接断言修复），但若实现成本超过价值则不强求。

### 3.2 兼容性

- 不改 `DocEditor` / `useRichTextEditor` package / mention / sticker 等其他用富文本的场景。
- §2.5.1 的 `update` 订阅只在 `RichTextInput.vue` 加，不污染共享 package。
- 不改 `editorExpanded` 状态机，不破坏「展开为帖子」流程。
- 不改键盘行为（Enter 提交仅在紧凑模式生效的现有规则保留）。
- §2.5.2 的 ResizeObserver 扩展只增加一个被观察目标（容器自身），不改 `onChildResize` 内部逻辑——`pendingRestore` / `isPaginating` / `userInteracting` 闸门继续生效，不引入新的滚动跳变路径。

## §4 验收门（G）

| G# | 验收项 | 验证方式 |
|---|---|---|
| G1 | ~~空状态下输入框视觉与改前一致（40px 单行紧凑）~~ → 空状态下 compact-composer 约 80px：editor 行（约 40px）+ action row（h-10，含 `+` / `@` / `Aa` / `GIF` / 展开 / 麦克风），两者共享一个 `rounded-lg bg-input` 容器，无侧栏异空 | 手测 |
| G2 | 输入第 2 行起，外框跟随内容长高，且过渡有动画 | 手测 |
| G3 | 内容超过 `40vh` 后，外框停止长高，内部出现滚动条 | 手测 |
| G4 | 粘贴附件后，框 ≥ 80px；附件 + 多行文字时，可长高至 40vh | 手测 |
| G5 | 单元测试 `RichTextInput.expand.test.ts` 三个用例全部通过 | `vitest` |
| G6 | 「展开编辑器」按钮仍可切换到帖子模式，且展开/收起行为不变 | 手测 + 测试 |
| G7 | 紧凑档下连续 `Shift+Enter` 至内容超过 40vh，光标始终保持在可视区底部附近（不滚出视野） | 手测 |
| G8 | 用户停在消息列表底部时，富文本输入框长高/缩回过程中最后一条消息始终保持可见、不被输入框压出可视区 | 手测 |

## §5 不在范围（YAGNI）

- 不引入 ResizeObserver / `scrollHeight` 测量 / inline style 计算高度。
- 不改帖子模式（`editorExpanded`）的 min/max 取值。
- 不改 `DocEditor` 或其他富文本输入场景。
- 不重构 `editorHeightClass` 为更通用的状态机——三档命名仍清晰，无需提前抽象。
- 不变更「展开」按钮的图标、title、可见性。
