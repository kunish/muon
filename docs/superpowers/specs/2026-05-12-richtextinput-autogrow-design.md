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

## §3 影响面

### 3.1 测试

- **必改**：`tests/components/RichTextInput.expand.test.ts:106-113` 的默认档断言。
  - 移除断言：`toContain('max-h-[40px]')` / `toContain('[&_.tiptap]:whitespace-nowrap')` / `toContain('[&_.tiptap_p]:truncate')` / `not.toContain('overflow-y-auto')`。
  - 新增断言：`toContain('overflow-y-auto')` / `toContain('max-h-[40vh]')` / `not.toContain('overflow-hidden')` / `not.toContain('whitespace-nowrap')` / `not.toContain('truncate')`。
  - 保留断言：`toContain('min-h-[40px]')`（min 没变）、`toContain('[&_.tiptap]:min-h-[24px]')`（内层 min 也没变）。
  - 第 122 行 `expect(expandedEditor.classes()).not.toContain('min-h-[40px]')` 保持不变（展开后 min 是 320px，仍成立）。
- **不动**：该文件第 2、3 个用例（"展开布局"、"展开发送"）不受影响。
- **视觉快照**：最近 commit `d38ec06 test(ui): baseline visual snapshots for Spec 2 molecules` 引入的快照若覆盖紧凑态 RichTextInput，需重新基线化；这是预期变化，不是回归。

### 3.2 兼容性

- 不改 `DocEditor` / `useRichTextEditor` package / mention / sticker 等其他用富文本的场景。
- 不改 `editorExpanded` 状态机，不破坏「展开为帖子」流程。
- 不改键盘行为（Enter 提交仅在紧凑模式生效的现有规则保留）。

## §4 验收门（G）

| G# | 验收项 | 验证方式 |
|---|---|---|
| G1 | 空状态下输入框视觉与改前一致（40px 单行紧凑） | 手测 + 视觉快照 |
| G2 | 输入第 2 行起，外框跟随内容长高，且过渡有动画 | 手测 |
| G3 | 内容超过 `40vh` 后，外框停止长高，内部出现滚动条 | 手测 |
| G4 | 粘贴附件后，框 ≥ 80px；附件 + 多行文字时，可长高至 40vh | 手测 |
| G5 | 单元测试 `RichTextInput.expand.test.ts` 三个用例全部通过 | `vitest` |
| G6 | 「展开编辑器」按钮仍可切换到帖子模式，且展开/收起行为不变 | 手测 + 测试 |

## §5 不在范围（YAGNI）

- 不引入 ResizeObserver / `scrollHeight` 测量 / inline style 计算高度。
- 不改帖子模式（`editorExpanded`）的 min/max 取值。
- 不改 `DocEditor` 或其他富文本输入场景。
- 不重构 `editorHeightClass` 为更通用的状态机——三档命名仍清晰，无需提前抽象。
- 不变更「展开」按钮的图标、title、可见性。
