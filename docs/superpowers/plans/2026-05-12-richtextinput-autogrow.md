# RichTextInput Auto-Grow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让聊天富文本输入框（紧凑模式）跟随内容自然长高，到 40vh 时改为内部滚动，去掉「输入第 2 行被截断」的破体验。

**Architecture:** 纯 CSS 改动。修改 `RichTextInput.vue` 中 `editorHeightClass` computed 的两档 class 字符串：默认档去掉 `overflow-hidden / max-h-[40px] / whitespace-nowrap / truncate`、把 `max` 提到 `40vh`；粘贴附件档把 `max` 由 `180px` 抬到 `40vh`。展开（帖子模式）档不动。无新增 JS、无新增依赖。

**Tech Stack:** Vue 3 + Tiptap（已有）+ Tailwind（已有）+ Vitest（已有）

**Spec:** `docs/superpowers/specs/2026-05-12-richtextinput-autogrow-design.md` (commit `de2a98f`)

---

## File Structure

- **Modify:** `src/features/chat/components/RichTextInput.vue:121-129` — `editorHeightClass` computed 的两档 class 字符串
- **Modify:** `tests/components/RichTextInput.expand.test.ts:106-113` — 第一个 it 用例的默认档断言

> 不新建文件，不动 `@muon/rich-text` package，不动其他富文本场景（`DocEditor` 等）。

---

## Task 1: 调整紧凑档 class 与对应单元测试断言（TDD）

**Files:**
- Modify: `tests/components/RichTextInput.expand.test.ts:106-113`
- Modify: `src/features/chat/components/RichTextInput.vue:121-129`

- [ ] **Step 1: 更新单元测试断言为新行为**

打开 `tests/components/RichTextInput.expand.test.ts`，把第 106-113 行替换为以下内容（仅默认档断言部分，其它行保持不变）：

```ts
const editor = wrapper.get('[data-testid="rich-editor"]')
expect(editor.classes()).toContain('overflow-y-auto')
expect(editor.classes()).toContain('min-h-[40px]')
expect(editor.classes()).toContain('max-h-[40vh]')
expect(editor.classes()).toContain('[&_.tiptap]:min-h-[24px]')
expect(editor.classes()).not.toContain('overflow-hidden')
expect(editor.classes()).not.toContain('max-h-[40px]')
expect(editor.classes()).not.toContain('[&_.tiptap]:whitespace-nowrap')
expect(editor.classes()).not.toContain('[&_.tiptap_p]:truncate')
```

> 该 `it` 用例后续部分（line 115 起的「点击展开按钮 → 断言展开档 class」）保持不变；展开档 class 没有变化。
> 文件中第二、三个 `it` 用例（`uses a Feishu-like post composer layout when expanded`、`sends the expanded post...`）完全不动。

- [ ] **Step 2: 跑测试，确认红（FAIL）**

Run:

```bash
pnpm test:unit -- tests/components/RichTextInput.expand.test.ts
```

Expected: 第一个 `it`（`gives the editor a visibly taller minimum height when expanded`）失败。失败信息应类似 `Expected to contain 'overflow-y-auto'` 或 `Expected not to contain 'overflow-hidden'`——证明默认档当前的 class 不符合新断言。第二、三个 `it` 仍通过。

如果测试在编译阶段就报错（语法错误），回到 Step 1 修正。

- [ ] **Step 3: 修改 `editorHeightClass` computed 为新 class**

打开 `src/features/chat/components/RichTextInput.vue`，把第 121-129 行的 computed 整段替换为：

```ts
const editorHeightClass = computed(() => {
  if (editorExpanded.value)
    return 'overflow-y-auto min-h-[320px] max-h-[60vh] [&_.tiptap]:min-h-[304px]'

  if (hasPendingPasteAttachments.value)
    return 'overflow-y-auto min-h-[80px] max-h-[40vh] [&_.tiptap]:min-h-[64px]'

  return 'overflow-y-auto min-h-[40px] max-h-[40vh] [&_.tiptap]:min-h-[24px]'
})
```

变更点逐行对照：
- 展开档（第 1 个 if 分支）：**完全不变**，仍是 `overflow-y-auto min-h-[320px] max-h-[60vh] [&_.tiptap]:min-h-[304px]`。
- 粘贴附件档（第 2 个 if 分支）：把 `max-h-[180px]` 改为 `max-h-[40vh]`；去掉 `[&_.tiptap]:overflow-visible` 和 `[&_.tiptap]:whitespace-normal`（默认档已不再有 `whitespace-nowrap` / `overflow-hidden`，无需反向覆盖）。
- 默认档（最后的 return）：从 `overflow-hidden min-h-[40px] max-h-[40px] [&_.tiptap]:min-h-[24px] [&_.tiptap]:overflow-hidden [&_.tiptap]:whitespace-nowrap [&_.tiptap_p]:truncate` 改为 `overflow-y-auto min-h-[40px] max-h-[40vh] [&_.tiptap]:min-h-[24px]`。

- [ ] **Step 4: 跑测试，确认绿（PASS）**

Run:

```bash
pnpm test:unit -- tests/components/RichTextInput.expand.test.ts
```

Expected: 三个 `it` 用例全部通过。

- [ ] **Step 5: 跑完整单元测试套件确认无回归**

Run:

```bash
pnpm test:unit
```

Expected: 全部通过。重点关注是否有其它测试断言了 `RichTextInput` 的旧 class（grep 验证）：

```bash
rg "max-h-\[40px\]|whitespace-nowrap.*tiptap|tiptap_p.*truncate" tests/
```

Expected: 无匹配，或仅匹配本次已更新的文件。

- [ ] **Step 6: 跑 lint**

Run:

```bash
pnpm lint
```

Expected: 通过。如有报错，按报错修正后回到 Step 4。

- [ ] **Step 7: Commit**

```bash
git add src/features/chat/components/RichTextInput.vue tests/components/RichTextInput.expand.test.ts
git commit -m "$(cat <<'EOF'
feat(chat): auto-grow compact rich text input up to 40vh

The compact composer used to cap at 40px and truncate everything past
the first line, forcing users to click "展开" just to see line 2.
Default and paste-attachment height classes now share a 40vh ceiling
and let the editor flow naturally up to that bound, with internal
scroll beyond. The explicit post-mode expand path is unchanged.

Spec: docs/superpowers/specs/2026-05-12-richtextinput-autogrow-design.md
EOF
)"
```

---

## Task 2: 浏览器手测验收门 G1–G4 / G6

CSS-only 改动 + 单元测试已覆盖 G5（class 形态）。运行时行为（自然撑高、动画、滚动）必须在真实浏览器里看一眼——unit test 用 `@vue/test-utils` mount 不会触发真实布局/绘制，无法替代。

**Files:** 无（仅运行 + 手测）

- [ ] **Step 1: 启动 desktop 开发环境**

Run（独立终端）：

```bash
pnpm dev:desktop
```

Expected: Electron 窗口打开，登录后进入主界面。

> 如果你只想验 web 端布局，用 `pnpm dev:web` + 浏览器开 `http://localhost:5173` 也可以。

- [ ] **Step 2: 验 G1（空状态视觉与改前一致）**

进入任一聊天房间。聚焦在底部富文本输入框，不输入任何内容。

Expected: 输入框高度 ~40px、单行 pill 视觉与改前完全一致；占位符（"输入消息..." 之类）正确显示。

- [ ] **Step 3: 验 G2（输入第 2 行起自动长高 + 动画）**

在输入框里持续输入，按 `Shift+Enter` 换行，输入至 2、3、4 行。

Expected:
- 输入第 2 行时，外框跟随长高，**不再截断**。
- 长高过程有平滑过渡动画（约 200ms），不是瞬间跳变。这一动画来源于现有 `transition-[max-height,min-height] duration-200`（`RichTextInput.vue:975`）。

- [ ] **Step 4: 验 G3（达 40vh 后改为内部滚动）**

继续输入更多行内容，直到输入框高度达到屏幕高度的约 40%。

Expected:
- 外框停止长高，固定在 ~40vh。
- 输入框内部出现垂直滚动条；继续输入时旧内容向上滚出可视区。
- 父布局（消息列表、上方工具栏）不被挤压变形。

- [ ] **Step 5: 验 G4（粘贴附件场景）**

在输入框聚焦的状态下，复制本机一张图片，粘贴（`Cmd+V`）。

Expected:
- 输入框立即长到至少 80px（缩略图坑位），缩略图正常显示，不被夹扁。
- 此时再输入多行文字，外框继续长高，**与不带附件时同一上限（40vh）**，不再受旧的 180px 上限限制。
- 删除附件后，输入框可缩回（取决于当前文字行数：纯空回到 40px，有文字回到对应行数高度）。

- [ ] **Step 6: 验 G6（「展开编辑器」按钮仍然切换帖子模式）**

清空输入框，点击「展开编辑器」按钮（输入框右侧附近，title 为 `chat.expand_editor` 对应的 i18n 文案）。

Expected:
- 切换到帖子模式：出现标题输入框、独立的格式工具栏、独立的发送按钮、独立的 action bar。
- 帖子模式的容器高度为 `min-h-[320px] max-h-[60vh]`（与改前一致）。
- 点击收起，回到紧凑模式，所有内容保留。

- [ ] **Step 7: 总结**

如果 G1–G4 + G6 + Task 1 的 G5 全部通过，本任务完成。
如果任一项有偏差，回 Task 1 修正 class 或测试，再重跑此 task。

> 此 task 不产生新 commit。

---

## Out of Scope（YAGNI 提醒，避免顺手扩张）

- 不引入 ResizeObserver / `scrollHeight` 测量 / 任何 JS 高度计算
- 不改帖子模式（`editorExpanded`）的高度档位（仍 `320px / 60vh`）
- 不动 `DocEditor`、`@muon/rich-text` package、其他富文本场景
- 不改「展开」按钮的图标、title、可见性
- 不重命名 `editorHeightClass` 或重构成更通用的状态机
- 不引入 motion preference (`prefers-reduced-motion`) 处理——既有过渡动画沿用原状

---

## Self-Review

- **Spec coverage:**
  - §2.1 受影响代码点 → Task 1 Step 3 修改 ✓
  - §2.3 默认档 class 表 → Task 1 Step 3 中默认档 return 串 ✓
  - §2.3 粘贴附件档 class 表 → Task 1 Step 3 中粘贴附件档 return 串 ✓
  - §2.3 展开档不变 → Task 1 Step 3 中展开档 return 串原样保留 ✓
  - §3.1 测试改动（移除/新增/保留断言）→ Task 1 Step 1 的断言列表 ✓
  - §4 G1 → Task 2 Step 2 ✓
  - §4 G2 → Task 2 Step 3 ✓
  - §4 G3 → Task 2 Step 4 ✓
  - §4 G4 → Task 2 Step 5 ✓
  - §4 G5 → Task 1 Steps 4-5 ✓
  - §4 G6 → Task 2 Step 6 ✓
- **Placeholder scan:** 无 TBD/TODO；所有 class 串、命令、断言均完整给出。
- **Type consistency:** `editorExpanded` / `hasPendingPasteAttachments` / `editorHeightClass` 命名贯穿一致；class 串原样拼接，无遗漏。
