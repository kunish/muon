# 占位 UI 入口填补 — 设计文档

- 日期：2026-05-14
- 范围：补齐当前在仓库中"渲染出来但点击不工作"的 4 处 UI 入口
- 关联：本 spec 不引入新 feature 域，全部改动落在 `src/features/{calendar,chat,docs}/` 内的现有组件与 store

## 1. 目标

把以下 4 处确认的"空壳按钮"接通到最小可用功能，使 UI 入口与实际行为一致：

| ID | 位置 | 文案 |
|----|------|------|
| A  | `src/features/calendar/components/CalendarPage.vue:633` | 重排（日程详情侧栏，紧邻"接受参加"） |
| B  | `src/features/chat/components/UnifiedInboxPanel.vue:232` | 自定义延后（延后菜单底部折叠 toggle） |
| C  | `src/features/chat/components/RichTextInput.vue:1122` | 展开 composer 发送按钮右侧的 ChevronDown |
| D  | `src/features/docs/components/DocsCreateButton.vue:73` | 导入文档（新建菜单第三项） |

## 2. 非目标

- 不补 D 的 DOCX / PDF 导入：本轮仅 Markdown + 纯文本；DOCX/PDF 改日由专门 spec 处理（涉及新依赖与解析风险）。
- 不重构 calendar / inbox / docs 的现有状态层。本 spec 只走"接 handler + 复用现有 store 方法"的最小路径。
- 不涉及 i18n key 的清理或新增（如确需新 key，集中列在第 7 节）。

## 3. 设计 — A · 重排日程

### 当前状态

`CalendarPage.vue` 在事件详情侧栏渲染了"接受参加 / 重排"两个按钮（L626-638）。"接受参加"接到 `acceptEvent(event)`（L331），后者用 `events.value.map(...)` 不可变更新本地 `events` ref。"重排" 没有 handler。

### 改动

1. 新增 popover 状态 `showReschedule = ref(false)` 与本地草稿 `rescheduleDraft = ref({ date: '', time: '', endTime: '' })`。
2. "重排" 按钮 `@click` 打开 popover，初始化 draft 为 `selectedEvent` 的当前 date / time / endTime。
3. Popover 内三个 `<input>`：`type="date"` × 1、`type="time"` × 2（开始 / 结束）。底部"确认重排"按钮触发 `rescheduleEvent(selectedEvent, rescheduleDraft.value)`。
4. 新增 `rescheduleEvent(event, draft)` 紧贴现有 `acceptEvent` 实现风格（L331-335）：

   ```ts
   function rescheduleEvent(event: CalendarEvent, draft: RescheduleDraft) {
     events.value = events.value.map(e =>
       e.id === event.id ? { ...e, date: draft.date, time: draft.time, endTime: draft.endTime } : e,
     )
     showReschedule.value = false
   }
   ```

5. 校验：若 `draft.time >= draft.endTime` 则"确认"按钮 `:disabled`。无 toast，按钮 disabled 即可。

### 数据流

`acceptEvent` 已经是 client-only 的本地 ref 更新——`rescheduleEvent` 走同样的语义，**不**调用 Matrix。这是项目当前 calendar 实现层级的实际状态，本 spec 不扩大它。

### 测试

- 单测：`tests/unit/features/calendar/CalendarPage.reschedule.spec.ts`
  - 渲染含一个事件 → 选中 → 点击重排 → 改时间 → 确认 → `selectedEvent.date/time/endTime` 已更新。
  - 结束时间早于开始时间 → 确认按钮 disabled。

## 4. 设计 — B · 自定义延后 toggle

### 当前状态

`UnifiedInboxPanel.vue` 已有 `customInputByItemId: Record<string, string>` 维护每条 inbox item 的草稿（L21）和 `submitCustomDefer(item)` 提交逻辑（L99）。但"自定义延后" toggle（L232）与下面的 datetime input + 确认按钮一直同时显示——按钮无 handler，input 永远展开。

### 改动

1. 新增 `customDeferOpenByItemId = ref<Record<string, boolean>>({})`，与已有的 `customInputByItemId` 同构。
2. 给 toggle 按钮接 `@click="customDeferOpenByItemId[id] = !customDeferOpenByItemId[id]"`。
3. 用 `v-if="customDeferOpenByItemId[items[virtualItem.index]!.id]"` 包裹 datetime input + 确认按钮。
4. 在 `toggleDeferMenu` 关闭菜单时同步清掉 `customDeferOpenByItemId[id]`，避免再次展开时残留状态。

### 数据流

完全 client-side。无新 store / 新 emit。

### 测试

- 单测：`tests/unit/chat/UnifiedInboxPanel.customDefer.spec.ts`
  - 默认情况下 input + 确认按钮不可见。
  - 点击 toggle → 可见 → 再次点击 → 隐藏。
  - 关闭整个 defer 菜单 → 再打开 → 自定义区仍是初始折叠态。

## 5. 设计 — C · 发送菜单 ChevronDown

### 当前状态

`RichTextInput.vue` 在展开 composer 底部 action bar（L1083-1128）渲染 emoji / mention / screenshot / attachment / send + 一个不接事件的 ChevronDown（L1122）。`submitEditor()`（L450）→ `submitComposer(html, text)`（L287）→ `sendTextMessage(roomId, body, html?)`（`src/matrix/messages/senders.ts:42`）。

### 改动

1. 把 ChevronDown 包进 ShadcnVue `DropdownMenu`：trigger 用现有按钮样式；content 单一菜单项 `chat.send_silent`（静默发送）。
2. 给 `submitEditor` 加可选参数 `options?: { silent?: boolean }`，把 `silent` 透传到 `submitComposer`。
3. `submitComposer` 同样接 `options?: { silent?: boolean }`，调用 `sendTextMessage(roomId, body, html, options)` 时透传。
4. `sendTextMessage` 签名扩展为：

   ```ts
   export async function sendTextMessage(
     roomId: string,
     body: string,
     html?: string,
     options?: { silent?: boolean },
   ): Promise<string>
   ```

   `createTextMessageContent` 内部，当 `options?.silent` 为真，在 content 上追加 `'org.matrix.msc4019.silent': true`（Element/Matrix 现行的 unstable 静默标志）。
5. DropdownMenu 项点击 → 调 `submitEditor({ silent: true })`，发送后菜单自动关闭。

### 兼容性 / 风险

- `org.matrix.msc4019.silent` 是 unstable MSC，部分 home server 可能忽略它——服务器若不识别会**按普通消息处理**（degrade gracefully），不会失败。Spec 接受这个降级。
- 现有所有调用 `sendTextMessage(roomId, body, html?)` 的地方因为 `options` 可选无需改动。

### 测试

- 单测：`tests/unit/matrix/senders.silent.spec.ts`
  - `sendTextMessage(..., { silent: true })` → mock 客户端收到的 content 带 `'org.matrix.msc4019.silent': true`。
  - 不传 options → content 不含该字段。
- 单测：`tests/unit/chat/RichTextInput.silentSend.spec.ts`
  - 点击 ChevronDown → DropdownMenu 可见。
  - 点击"静默发送" → `submitComposer` 被以 `{ silent: true }` 调用一次，菜单关闭，编辑器清空。

## 6. 设计 — D · 导入文档（Markdown / 纯文本）

### 当前状态

`DocsCreateButton.vue` 是一个 emit-only 的弹出菜单（L5-8 暴露 `createDoc` / `createFolder` 两个事件）。父组件 `DocsPage.vue` 监听 `createDoc` 调用 `store.createDocument(title, folder)`（`docsStore.ts:735`）。"导入文档"按钮无 handler、无 emit。

### 改动

1. **DocsCreateButton.vue**：
   - 给 emits 新增 `importDoc: [file: File]`。
   - "导入文档"按钮 `@click="triggerImport"`；新增隐藏 `<input ref="fileInput" type="file" accept=".md,.markdown,.txt" @change="onFileChosen">`。
   - `triggerImport` 关闭菜单后 `fileInput.value?.click()`；`onFileChosen` 读取 `event.target.files[0]` → `emit('importDoc', file)`。
2. **DocsPage.vue**：
   - 监听 `@import-doc="importDoc"`。
   - `async function importDoc(file: File)`：
     1. `const text = await file.text()`
     2. `const title = stripExtension(file.name) || '导入的文档'`
     3. `const docId = await store.createDocument(title, store.activeFolder)`
     4. `await store.appendMarkdown(docId, text)`（见下方 store 扩展）
3. **docsStore.ts**：新增 `appendMarkdown(docId: string, markdown: string): Promise<void>`。语义：把 markdown 内容作为新文档的初始正文，发送一条 `m.room.message` 进入该 doc 的 Matrix 房间——`docId` 本身就是 `room_id`（见 `createDocument` 实现：返回 `result.room_id`，`docsStore.ts:773`）。具体调用 `sendTextMessage(docId, plainText, optionalHtml)`（`src/matrix/messages/senders.ts:42`）。文档编辑器对该 room 的 timeline 订阅会让导入内容自然出现。`optionalHtml` 仅在仓库已有 markdown→html renderer 时填充——见下节"Markdown → HTML"。
4. **导入限制**：文件 > 1 MB 弹 `toast.error(t('docs.import_too_large'))`，不继续；非允许扩展名由 `accept` 提示，浏览器拦截。

### Markdown → HTML

复用项目已有的 markdown 渲染能力。先在 `packages/rich-text` 或 `src/features/docs/lib/` 下检查现有 markdown renderer；若无，使用 `marked`（项目 `pnpm-lock.yaml` 已存在依赖时直接用；否则在本 spec 走"纯文本作为 body，html 字段留空"的最小路径——这样**不引入新依赖**，符合非目标第 1 条的精神）。

> 实现期：若仓库已有 markdown→html 工具，import 时同时填 `formatted_body`；若没有，则首版只填 `body`（plain text），让用户在文档编辑器里看到原 markdown 文本而非渲染结果。Plan 阶段做这次依赖检查。

### 测试

- 单测：`tests/unit/docs/DocsCreateButton.import.spec.ts`
  - 点击"导入文档" → 隐藏 file input 被 click → 选中 `.md` → emit `importDoc` 一次，payload 为 File。
- 单测：`tests/unit/docs/DocsPage.import.spec.ts`
  - mock store.createDocument 返回 docId；emit `importDoc` 含 1KB markdown 文件 → `createDocument` 被以正确 title 调用一次，`appendMarkdown` 被以 docId + 文件内容调用一次。
  - 5 MB 文件 → toast.error 被调用，无 store 调用。

## 7. i18n 新增 key

- `chat.send_silent` — "静默发送"
- `docs.import_doc` — "导入文档"（若现存"导入文档"是硬编码中文，本 spec 同时把硬编码替换为 i18n key）
- `docs.import_too_large` — "文件过大，最多支持 1 MB"
- `calendar.reschedule_confirm` — "确认重排"
- `calendar.reschedule_invalid_time` — 仅用于 disabled 状态 tooltip

所有 key 都加在现有 zh / en 两个 locale 文件里；若仅有 zh 也只加 zh。

## 8. 实施顺序（建议）

1. B（最小，~5 行 + 1 测试） — 立即解锁 inbox 体验
2. C（含 sender 改造，但接口扩展是 additive，影响面小）
3. A（仅 calendar 内部状态，已有清晰先例）
4. D（最大，独立组件 + store 函数 + 解析路径）

四项相互独立，可分 4 个 commit 落地。

## 9. 风险

- **C 的 silent 标志**：MSC4019 是 unstable，未来 Matrix 收敛到 `m.silent` 后需要换 key。Risk 接受度高，加注释指明 MSC 编号。
- **D 的 markdown 渲染**：若仓库无可复用 renderer，首版仅 plain text。可能导致用户期望落差（"导入的 markdown 没渲染"）。Plan 阶段做依赖审计，必要时补 issue。
- **重排不写回 Matrix**：与 `acceptEvent` 一致——calendar 当前 layer 就是 client-only。未来 calendar 真接 Matrix 时这个函数也要跟着升级，但是 calendar 整体的改造另立 spec。

## 10. 复核 checklist

- [ ] 所有改动局限于本 spec 提到的文件
- [ ] 没有引入新 npm 依赖
- [ ] 每项至少 1 个单测
- [ ] i18n 新 key 不缺 zh
- [ ] `sendTextMessage` 的现有调用方未被破坏
