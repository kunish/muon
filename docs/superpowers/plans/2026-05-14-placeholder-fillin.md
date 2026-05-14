# Placeholder UI Fill-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up 4 confirmed empty UI entry points (calendar reschedule, inbox custom-defer toggle, composer silent-send chevron, docs import) to minimal viable behavior without introducing new npm dependencies.

**Architecture:** Each placeholder is independent. We add: a local popover for calendar reschedule, a per-item boolean map for inbox toggle, a `DropdownMenu` for the composer's split-send + an additive `options.silent` parameter that threads from `submitEditor → submitComposer → sendTextMessage → m.room.message content`, and a hidden `<input type="file">` for docs import that reads markdown/text and writes it into the new doc's Matrix room via the existing `createDocument` + `sendTextMessage` pair.

**Tech Stack:** Vue 3 (Composition API), TypeScript, Pinia, vitest (jsdom) + `@vue/test-utils`, ShadcnVue `DropdownMenu` (already in repo), `matrix-js-sdk`. Locales in `src/locales/{en,zh}.json` via vue-i18n.

**Spec:** `docs/superpowers/specs/2026-05-14-placeholder-fillin-design.md`

---

## File Structure

**Modify:**
- `src/features/chat/components/UnifiedInboxPanel.vue` — add custom-defer open/close map, wire toggle button, gate input + confirm with `v-if`
- `src/matrix/messages/senders.ts` — extend `sendTextMessage` signature with `options?: { silent?: boolean }`; thread `'org.matrix.msc4019.silent': true` into content
- `src/features/chat/components/RichTextInput.vue` — replace lone ChevronDown with `DropdownMenu` exposing "静默发送" item; thread `{ silent }` through `submitEditor` → `submitComposer` → `sendTextMessage`
- `src/features/calendar/components/CalendarPage.vue` — add popover state, `rescheduleEvent` mirroring `acceptEvent`, wire "重排" button to popover
- `src/features/docs/components/DocsCreateButton.vue` — new emit `importDoc`, hidden file input, "导入文档" button wiring
- `src/features/docs/components/DocsPage.vue` — handle `import-doc` event by `createDocument` + `appendMarkdown`
- `src/features/docs/stores/docsStore.ts` — add `appendMarkdown(docId, markdown)` using existing `sendTextMessage`
- `src/locales/zh.json`, `src/locales/en.json` — add `chat.send_silent`, `docs.import_doc`, `docs.import_too_large`, `calendar.reschedule_confirm`, `calendar.reschedule_invalid_time`

**Create (tests only):**
- `tests/components/UnifiedInboxPanel.customDefer.test.ts`
- `tests/unit/matrix/senders.silent.test.ts`
- `tests/components/RichTextInput.silentSend.test.ts`
- `tests/components/CalendarPage.reschedule.test.ts`
- `tests/components/DocsCreateButton.import.test.ts`
- `tests/components/DocsPage.import.test.ts`

**Implementation order rationale:** B (smallest, no deps) → C-sender (additive signature) → C-composer (consumer of C-sender) → A (independent) → D-store (foundation) → D-button (file picker) → D-page (orchestration) → i18n keys → final sweep.

---

## Task 1: B · Inbox custom-defer toggle

**Files:**
- Modify: `src/features/chat/components/UnifiedInboxPanel.vue:21`, `:85-96`, `:232-254`
- Test: `tests/components/UnifiedInboxPanel.customDefer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/components/UnifiedInboxPanel.customDefer.test.ts`:

```typescript
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import UnifiedInboxPanel from '@/features/chat/components/UnifiedInboxPanel.vue'
import { __resetUnifiedInboxForTests } from '@/features/chat/composables/useUnifiedInbox'

describe('unifiedInboxPanel custom defer toggle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    __resetUnifiedInboxForTests()
  })

  it('hides the custom defer input + confirm until the toggle is clicked', async () => {
    const wrapper = mount(UnifiedInboxPanel)
    await nextTick()

    const triggers = wrapper.findAll('[data-testid^="inbox-defer-trigger-"]')
    expect(triggers.length).toBeGreaterThan(0)
    const itemId = triggers[0]!.attributes('data-testid')!.replace('inbox-defer-trigger-', '')

    await triggers[0]!.trigger('click')
    await nextTick()

    expect(wrapper.find(`[data-testid="inbox-defer-custom-toggle-${itemId}"]`).exists()).toBe(true)
    expect(wrapper.find(`[data-testid="inbox-defer-custom-input-${itemId}"]`).exists()).toBe(false)
    expect(wrapper.find(`[data-testid="inbox-defer-custom-submit-${itemId}"]`).exists()).toBe(false)

    await wrapper.find(`[data-testid="inbox-defer-custom-toggle-${itemId}"]`).trigger('click')
    await nextTick()

    expect(wrapper.find(`[data-testid="inbox-defer-custom-input-${itemId}"]`).exists()).toBe(true)
    expect(wrapper.find(`[data-testid="inbox-defer-custom-submit-${itemId}"]`).exists()).toBe(true)

    await wrapper.find(`[data-testid="inbox-defer-custom-toggle-${itemId}"]`).trigger('click')
    await nextTick()
    expect(wrapper.find(`[data-testid="inbox-defer-custom-input-${itemId}"]`).exists()).toBe(false)
  })

  it('resets the custom defer expanded state when defer menu is closed and reopened', async () => {
    const wrapper = mount(UnifiedInboxPanel)
    await nextTick()

    const trigger = wrapper.find('[data-testid^="inbox-defer-trigger-"]')
    const itemId = trigger.attributes('data-testid')!.replace('inbox-defer-trigger-', '')

    await trigger.trigger('click')
    await nextTick()
    await wrapper.find(`[data-testid="inbox-defer-custom-toggle-${itemId}"]`).trigger('click')
    await nextTick()
    expect(wrapper.find(`[data-testid="inbox-defer-custom-input-${itemId}"]`).exists()).toBe(true)

    await trigger.trigger('click')
    await nextTick()
    expect(wrapper.find(`[data-testid="inbox-defer-custom-toggle-${itemId}"]`).exists()).toBe(false)

    await trigger.trigger('click')
    await nextTick()
    expect(wrapper.find(`[data-testid="inbox-defer-custom-input-${itemId}"]`).exists()).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/UnifiedInboxPanel.customDefer.test.ts`
Expected: 2 tests fail — input + submit are visible from the start, never hidden by the toggle.

- [ ] **Step 3: Add open-state map and reset hook**

In `src/features/chat/components/UnifiedInboxPanel.vue`, find the existing line:

```ts
const customInputByItemId = ref<Record<string, string>>({})
```

Add immediately after it:

```ts
const customDeferOpenByItemId = ref<Record<string, boolean>>({})
```

Then find `toggleDeferMenu`:

```ts
function toggleDeferMenu(itemId: string) {
  deferMenuItemId.value = deferMenuItemId.value === itemId ? null : itemId
}
```

Replace with:

```ts
function toggleDeferMenu(itemId: string) {
  if (deferMenuItemId.value === itemId) {
    deferMenuItemId.value = null
    customDeferOpenByItemId.value[itemId] = false
  }
  else {
    deferMenuItemId.value = itemId
  }
}
```

- [ ] **Step 4: Wire the toggle button + gate the input/submit**

In the same file, find the block starting around L231:

```vue
<div class="mt-2 border-t border-border/60 pt-2">
  <button
    type="button"
    class="w-full rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
    :data-testid="`inbox-defer-custom-toggle-${items[virtualItem.index]!.id}`"
  >
    {{ t('chat.defer_custom') }}
  </button>
  <input
    v-model="customInputByItemId[items[virtualItem.index]!.id]"
    type="datetime-local"
    class="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
    :data-testid="`inbox-defer-custom-input-${items[virtualItem.index]!.id}`"
  >
  <button
    type="button"
    class="mt-1 w-full rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
    :disabled="!customInputByItemId[items[virtualItem.index]!.id]"
    :data-testid="`inbox-defer-custom-submit-${items[virtualItem.index]!.id}`"
    @click="submitCustomDefer(items[virtualItem.index]!)"
  >
    {{ t('common.confirm') }}
  </button>
</div>
```

Replace with:

```vue
<div class="mt-2 border-t border-border/60 pt-2">
  <button
    type="button"
    class="w-full rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
    :data-testid="`inbox-defer-custom-toggle-${items[virtualItem.index]!.id}`"
    @click="customDeferOpenByItemId[items[virtualItem.index]!.id] = !customDeferOpenByItemId[items[virtualItem.index]!.id]"
  >
    {{ t('chat.defer_custom') }}
  </button>
  <template v-if="customDeferOpenByItemId[items[virtualItem.index]!.id]">
    <input
      v-model="customInputByItemId[items[virtualItem.index]!.id]"
      type="datetime-local"
      class="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
      :data-testid="`inbox-defer-custom-input-${items[virtualItem.index]!.id}`"
    >
    <button
      type="button"
      class="mt-1 w-full rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
      :disabled="!customInputByItemId[items[virtualItem.index]!.id]"
      :data-testid="`inbox-defer-custom-submit-${items[virtualItem.index]!.id}`"
      @click="submitCustomDefer(items[virtualItem.index]!)"
    >
      {{ t('common.confirm') }}
    </button>
  </template>
</div>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/components/UnifiedInboxPanel.customDefer.test.ts`
Expected: both tests PASS.

- [ ] **Step 6: Run the existing inbox suite to confirm no regression**

Run: `pnpm vitest run tests/components/UnifiedInboxPanel.test.ts tests/components/UnifiedInboxPanel.recovery.test.ts tests/components/UnifiedInboxPanel.performance.test.ts`
Expected: all existing inbox tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/chat/components/UnifiedInboxPanel.vue tests/components/UnifiedInboxPanel.customDefer.test.ts
git commit -m "feat(inbox): collapse custom-defer input behind toggle button"
```

---

## Task 2: C · Extend `sendTextMessage` with silent option

**Files:**
- Modify: `src/matrix/messages/senders.ts:15-21`, `:42-46`, `:48-63`
- Test: `tests/unit/matrix/senders.silent.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/matrix/senders.silent.test.ts`:

```typescript
import { MsgType } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendTextMessage } from '@/matrix/messages/senders'

const sendMessage = vi.fn(async () => ({ event_id: '$evt:localhost' }))

vi.mock('@/matrix/client', () => ({
  getClient: () => ({ sendMessage }),
}))

describe('sendTextMessage silent option', () => {
  beforeEach(() => {
    sendMessage.mockClear()
  })

  it('does not include the silent flag when option is omitted', async () => {
    await sendTextMessage('!room:localhost', 'hello')

    expect(sendMessage).toHaveBeenCalledTimes(1)
    const [, content] = sendMessage.mock.calls[0]!
    expect(content).toMatchObject({ msgtype: MsgType.Text, body: 'hello' })
    expect((content as Record<string, unknown>)['org.matrix.msc4019.silent']).toBeUndefined()
  })

  it('attaches org.matrix.msc4019.silent: true when silent is true', async () => {
    await sendTextMessage('!room:localhost', 'hello', undefined, { silent: true })

    const [, content] = sendMessage.mock.calls[0]!
    expect((content as Record<string, unknown>)['org.matrix.msc4019.silent']).toBe(true)
  })

  it('preserves formatted_body alongside silent flag', async () => {
    await sendTextMessage('!room:localhost', 'hi', '<p><strong>hi</strong></p>', { silent: true })

    const [, content] = sendMessage.mock.calls[0]!
    expect(content).toMatchObject({
      'msgtype': MsgType.Text,
      'body': 'hi',
      'format': 'org.matrix.custom.html',
      'org.matrix.msc4019.silent': true,
    })
    expect((content as Record<string, string>).formatted_body).toContain('<strong>hi</strong>')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/matrix/senders.silent.test.ts`
Expected: TypeScript / type error or runtime fail — `sendTextMessage` does not accept a 4th argument.

- [ ] **Step 3: Extend the type and signature**

In `src/matrix/messages/senders.ts`, find the `MatrixTextContent` interface (L15-21):

```ts
interface MatrixTextContent {
  'msgtype': MsgType.Text
  'body': string
  'format'?: typeof MATRIX_HTML_FORMAT
  'formatted_body'?: string
  'm.mentions'?: { user_ids: string[] }
}
```

Replace with:

```ts
interface MatrixTextContent {
  'msgtype': MsgType.Text
  'body': string
  'format'?: typeof MATRIX_HTML_FORMAT
  'formatted_body'?: string
  'm.mentions'?: { user_ids: string[] }
  // Unstable: MSC4019. Servers that don't recognize this key MUST treat the message as normal.
  'org.matrix.msc4019.silent'?: true
}
```

Then find `sendTextMessage` (L42-46):

```ts
export async function sendTextMessage(roomId: string, body: string, html?: string): Promise<string> {
  const content = createTextMessageContent(body, html)
  const res = await getClient().sendMessage(roomId, content as RoomMessageEventContent)
  return res.event_id
}
```

Replace with:

```ts
export interface SendTextOptions {
  silent?: boolean
}

export async function sendTextMessage(
  roomId: string,
  body: string,
  html?: string,
  options?: SendTextOptions,
): Promise<string> {
  const content = createTextMessageContent(body, html, options)
  const res = await getClient().sendMessage(roomId, content as RoomMessageEventContent)
  return res.event_id
}
```

Then find `createTextMessageContent` (L48-63):

```ts
function createTextMessageContent(body: string, html?: string): MatrixTextContent {
  if (html && !isPlainEditorHtml(html, body)) {
    const { html: matrixHtml, userIds } = convertMentionsToMatrix(html)
    const formattedBody = sanitizeMatrixHtml(matrixHtml)
    return {
      msgtype: MsgType.Text,
      body,
      format: MATRIX_HTML_FORMAT,
      formatted_body: formattedBody,
      // 添加 m.mentions 用于通知被提及的用户
      ...(userIds.length > 0 ? { 'm.mentions': { user_ids: userIds } } : {}),
    }
  }

  return { msgtype: MsgType.Text, body }
}
```

Replace with:

```ts
function createTextMessageContent(body: string, html?: string, options?: SendTextOptions): MatrixTextContent {
  const silentTag = options?.silent ? ({ 'org.matrix.msc4019.silent': true } as const) : null
  if (html && !isPlainEditorHtml(html, body)) {
    const { html: matrixHtml, userIds } = convertMentionsToMatrix(html)
    const formattedBody = sanitizeMatrixHtml(matrixHtml)
    return {
      msgtype: MsgType.Text,
      body,
      format: MATRIX_HTML_FORMAT,
      formatted_body: formattedBody,
      // 添加 m.mentions 用于通知被提及的用户
      ...(userIds.length > 0 ? { 'm.mentions': { user_ids: userIds } } : {}),
      ...(silentTag ?? {}),
    }
  }

  return { msgtype: MsgType.Text, body, ...(silentTag ?? {}) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/matrix/senders.silent.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Run downstream type-check / wider tests**

Run: `pnpm vitest run tests/components/RichTextInput.send.test.ts`
Expected: PASS — existing 3-arg callers still type-check because `options` is optional.

Run: `pnpm tsc --noEmit`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/matrix/messages/senders.ts tests/unit/matrix/senders.silent.test.ts
git commit -m "feat(matrix): add silent option to sendTextMessage (MSC4019)"
```

---

## Task 3: C · Composer split-send DropdownMenu

**Files:**
- Modify: `src/features/chat/components/RichTextInput.vue` script imports, `submitEditor` (L450), `submitComposer` (L287), template (L1113-1127)
- Modify: `src/locales/zh.json`, `src/locales/en.json` — add `chat.send_silent`
- Test: `tests/components/RichTextInput.silentSend.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/components/RichTextInput.silentSend.test.ts`. Start from the same mock setup as `tests/components/RichTextInput.send.test.ts` so the editor mocks match. Copy the entire `mocks`, `vi.hoisted`, and all `vi.mock(...)` blocks from `tests/components/RichTextInput.send.test.ts` (lines 1-184) verbatim — they are already factored to support testing this file. Then append the test body below.

```typescript
// (paste the full mock setup from RichTextInput.send.test.ts here)

describe('richTextInput silent send', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.editorText = 'hi'
    mocks.editorHtml = '<p>hi</p>'
    mocks.onSubmit = undefined
  })

  it('threads silent: true when the silent-send menu item is clicked', async () => {
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    const wrapper = mountInput()
    await nextTick()

    // Open the split-send menu
    const trigger = wrapper.find('[data-testid="expanded-send-more-trigger"]')
    expect(trigger.exists()).toBe(true)
    await trigger.trigger('click')
    await nextTick()

    const silentItem = wrapper.find('[data-testid="expanded-send-silent"]')
    expect(silentItem.exists()).toBe(true)
    await silentItem.trigger('click')
    await nextTick()

    expect(mocks.sendTextMessage).toHaveBeenCalledTimes(1)
    const lastCall = mocks.sendTextMessage.mock.calls[0]!
    expect(lastCall[0]).toBe('!room:localhost')
    expect(lastCall[1]).toBe('hi')
    expect(lastCall[3]).toEqual({ silent: true })
  })

  it('passes no options when the regular send button is clicked', async () => {
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    const wrapper = mountInput()
    await nextTick()

    await wrapper.find('[data-testid="expanded-send"]').trigger('click')
    await nextTick()

    expect(mocks.sendTextMessage).toHaveBeenCalledTimes(1)
    const lastCall = mocks.sendTextMessage.mock.calls[0]!
    // 4th arg is either undefined or { silent: false / undefined } — both acceptable.
    const opts = lastCall[3] as { silent?: boolean } | undefined
    expect(opts?.silent).not.toBe(true)
  })
})
```

Note: `mountInput()` already stubs `Teleport` and dialogs in the existing send test. If `DropdownMenu` in `reka-ui` (the ShadcnVue base) uses Teleport for its content, the stubs may need to include `DropdownMenuContent` rendered inline — add `DropdownMenuPortal: false` is NOT a recognized stub, so instead pass `attachTo: document.body` is unnecessary in jsdom. The clean approach: use the `data-testid` on the trigger and menu item; if `DropdownMenuContent` is portaled outside the wrapper root, replace `wrapper.find(...)` with `document.querySelector(...)`. After Step 3 below, re-run the test; if menu content is portaled out, switch the two `wrapper.find('[data-testid="expanded-send-silent"]')` calls to:

```ts
const silentItem = document.querySelector('[data-testid="expanded-send-silent"]') as HTMLElement
expect(silentItem).toBeTruthy()
silentItem.dispatchEvent(new MouseEvent('click', { bubbles: true }))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/RichTextInput.silentSend.test.ts`
Expected: FAIL — `expanded-send-more-trigger` does not exist, no DropdownMenu wired.

- [ ] **Step 3: Thread the silent option through composer methods**

In `src/features/chat/components/RichTextInput.vue`, find `submitComposer` (around L287). Its current signature is:

```ts
async function submitComposer(html: string, text: string): Promise<boolean> {
```

Change to:

```ts
async function submitComposer(html: string, text: string, options?: { silent?: boolean }): Promise<boolean> {
```

Inside `submitComposer`, locate the call (around L427):

```ts
await sendTextMessage(roomId, text, html)
```

Replace with:

```ts
await sendTextMessage(roomId, text, html, options)
```

Then find `submitEditor` (L450-459):

```ts
async function submitEditor() {
  const html = editor.value?.getHTML() || ''
  const text = editor.value?.getText() || ''
  const payload = createSubmitPayload(html, text)
  if (!store.currentRoomId || (!payload.text.trim() && !hasPendingPasteAttachments.value))
    return
  const submitted = await submitComposer(payload.html, payload.text)
  if (submitted)
    postTitle.value = ''
}
```

Replace with:

```ts
async function submitEditor(options?: { silent?: boolean }) {
  const html = editor.value?.getHTML() || ''
  const text = editor.value?.getText() || ''
  const payload = createSubmitPayload(html, text)
  if (!store.currentRoomId || (!payload.text.trim() && !hasPendingPasteAttachments.value))
    return
  const submitted = await submitComposer(payload.html, payload.text, options)
  if (submitted)
    postTitle.value = ''
}

function submitEditorSilent() {
  void submitEditor({ silent: true })
}
```

Also check the `useRichTextEditor({ onSubmit: submitComposer })` call (around L131-133). The `onSubmit` callback there forwards `(html, text)` — its signature need not change since keyboard-submit defaults to non-silent. No edit needed.

- [ ] **Step 4: Add imports for DropdownMenu**

Find the existing imports section (near top of `<script setup>` block). Locate where ShadcnVue components are imported (search for `from '@/shared/components/ui/'` or similar — confirm path by reading any existing usage). Confirm DropdownMenu exists in repo:

Run: `find src -path '*components/ui*' -name 'DropdownMenu*' | head -5`
Expected: paths like `src/shared/components/ui/dropdown-menu/DropdownMenu.vue` exist.

If those paths exist, add an import line in `RichTextInput.vue` script block:

```ts
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
```

If the resolved location uses a different export shape (e.g. individual file imports), match the pattern used in another composer-adjacent component such as `src/features/chat/components/ChatSettingsPanel.vue` — search it for `DropdownMenu` and copy the exact import.

- [ ] **Step 5: Replace the lone ChevronDown with the DropdownMenu**

In `RichTextInput.vue`, find the block around L1113-1127:

```vue
<button
  data-testid="expanded-send"
  class="inline-flex h-8 w-8 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10"
  :title="t('chat.send')"
  @click="submitEditor"
>
  <SendHorizontal :size="19" />
</button>
<div class="mx-1 h-5 w-px bg-border" />
<button
  class="inline-flex h-8 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
  :title="t('chat.action_more')"
>
  <ChevronDown :size="14" />
</button>
```

Replace with:

```vue
<button
  data-testid="expanded-send"
  class="inline-flex h-8 w-8 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10"
  :title="t('chat.send')"
  @click="() => submitEditor()"
>
  <SendHorizontal :size="19" />
</button>
<div class="mx-1 h-5 w-px bg-border" />
<DropdownMenu>
  <DropdownMenuTrigger as-child>
    <button
      data-testid="expanded-send-more-trigger"
      class="inline-flex h-8 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      :title="t('chat.action_more')"
    >
      <ChevronDown :size="14" />
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem data-testid="expanded-send-silent" @click="submitEditorSilent">
      {{ t('chat.send_silent') }}
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

Note the `@click="submitEditor"` → `@click="() => submitEditor()"` change on the primary send button — Vue would otherwise pass the MouseEvent as `options` when `submitEditor` accepts an argument.

- [ ] **Step 6: Add i18n key**

In `src/locales/zh.json`, find the `chat` object and add inside it (next to `send`):

```json
"send_silent": "静默发送",
```

In `src/locales/en.json`, add the corresponding entry:

```json
"send_silent": "Send silently",
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm vitest run tests/components/RichTextInput.silentSend.test.ts`
Expected: 2 tests PASS.

If `DropdownMenuContent` is portaled outside the wrapper and the first run fails to find `expanded-send-silent`, apply the `document.querySelector` fallback noted in Step 1.

- [ ] **Step 8: Run existing composer suite**

Run: `pnpm vitest run tests/components/RichTextInput.send.test.ts tests/components/RichTextInput.expand.test.ts`
Expected: all existing composer tests PASS — `submitEditor` is still parameter-compatible (no arg or `{ silent }`), and the `() => submitEditor()` wrapper preserves prior semantics on the primary send button.

- [ ] **Step 9: Commit**

```bash
git add src/features/chat/components/RichTextInput.vue src/locales/zh.json src/locales/en.json tests/components/RichTextInput.silentSend.test.ts
git commit -m "feat(composer): wire split-send chevron to silent-send dropdown"
```

---

## Task 4: A · Calendar reschedule popover

**Files:**
- Modify: `src/features/calendar/components/CalendarPage.vue` script (after L335), template (L633-637)
- Modify: `src/locales/zh.json`, `src/locales/en.json` — add `calendar.reschedule_confirm`, `calendar.reschedule_invalid_time`
- Test: `tests/components/CalendarPage.reschedule.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/components/CalendarPage.reschedule.test.ts`:

```typescript
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import CalendarPage from '@/features/calendar/components/CalendarPage.vue'

describe('calendar reschedule popover', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('opens the popover, updates date/time/endTime, and reflects them in the detail panel', async () => {
    const wrapper = mount(CalendarPage)
    await nextTick()

    const eventButton = wrapper.find('[data-testid^="calendar-event-"]')
    expect(eventButton.exists()).toBe(true)
    await eventButton.trigger('click')
    await nextTick()

    const trigger = wrapper.find('[data-testid="event-reschedule-trigger"]')
    expect(trigger.exists()).toBe(true)
    await trigger.trigger('click')
    await nextTick()

    const dateInput = wrapper.find('[data-testid="reschedule-date"]')
    const startInput = wrapper.find('[data-testid="reschedule-start"]')
    const endInput = wrapper.find('[data-testid="reschedule-end"]')
    expect(dateInput.exists()).toBe(true)
    expect(startInput.exists()).toBe(true)
    expect(endInput.exists()).toBe(true)

    await dateInput.setValue('2026-06-01')
    await startInput.setValue('10:00')
    await endInput.setValue('11:00')

    const confirm = wrapper.find('[data-testid="reschedule-confirm"]')
    expect(confirm.attributes('disabled')).toBeUndefined()
    await confirm.trigger('click')
    await nextTick()

    const detailText = wrapper.find('[data-testid="event-detail-time"]').text()
    expect(detailText).toContain('2026-06-01')
    expect(detailText).toContain('10:00')
    expect(detailText).toContain('11:00')
  })

  it('disables confirm when end time is not after start time', async () => {
    const wrapper = mount(CalendarPage)
    await nextTick()
    await wrapper.find('[data-testid^="calendar-event-"]').trigger('click')
    await wrapper.find('[data-testid="event-reschedule-trigger"]').trigger('click')
    await nextTick()

    await wrapper.find('[data-testid="reschedule-date"]').setValue('2026-06-01')
    await wrapper.find('[data-testid="reschedule-start"]').setValue('10:00')
    await wrapper.find('[data-testid="reschedule-end"]').setValue('09:00')
    await nextTick()

    const confirm = wrapper.find('[data-testid="reschedule-confirm"]')
    expect(confirm.attributes('disabled')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/CalendarPage.reschedule.test.ts`
Expected: FAIL — `event-reschedule-trigger`, `reschedule-date` etc do not exist.

- [ ] **Step 3: Add reschedule state and function**

In `src/features/calendar/components/CalendarPage.vue`, after the existing `acceptEvent` function (currently ends L335):

```ts
function acceptEvent(event: CalendarEvent) {
  events.value = events.value.map(e =>
    e.id === event.id ? { ...e, rsvpStatus: '已接受' } : e,
  )
}
```

Add immediately after:

```ts
interface RescheduleDraft {
  date: string
  time: string
  endTime: string
}

const showReschedule = ref(false)
const rescheduleDraft = ref<RescheduleDraft>({ date: '', time: '', endTime: '' })

function openReschedule(event: CalendarEvent) {
  rescheduleDraft.value = {
    date: event.date,
    time: event.time,
    endTime: event.endTime ?? event.time,
  }
  showReschedule.value = true
}

function rescheduleConfirmDisabled(): boolean {
  const { date, time, endTime } = rescheduleDraft.value
  return !date || !time || !endTime || endTime <= time
}

function rescheduleEvent(event: CalendarEvent) {
  if (rescheduleConfirmDisabled())
    return
  const { date, time, endTime } = rescheduleDraft.value
  events.value = events.value.map(e =>
    e.id === event.id ? { ...e, date, time, endTime } : e,
  )
  showReschedule.value = false
}
```

You will likely need to add `ref` to the existing `vue` import at the top of the script block if it is not already imported. (`ref` is virtually certainly already imported in this file — verify by searching: `grep -n "from 'vue'" src/features/calendar/components/CalendarPage.vue`. If `ref` is missing from the destructure, add it.)

- [ ] **Step 4: Wire the template**

In the same file, find the existing "重排" button block (L633-637):

```vue
<button
  class="h-8 rounded-md border border-border px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
>
  {{ t('calendar.reschedule') }}
</button>
```

Replace with:

```vue
<div class="relative">
  <button
    data-testid="event-reschedule-trigger"
    class="h-8 rounded-md border border-border px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
    @click="openReschedule(selectedEvent)"
  >
    {{ t('calendar.reschedule') }}
  </button>
  <div
    v-if="showReschedule"
    class="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-border bg-card p-3 shadow-lg"
  >
    <label class="mb-1 block text-[11px] text-muted-foreground">{{ t('calendar.date') }}</label>
    <input
      v-model="rescheduleDraft.date"
      data-testid="reschedule-date"
      type="date"
      class="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
    >
    <div class="mt-2 grid grid-cols-2 gap-2">
      <div>
        <label class="mb-1 block text-[11px] text-muted-foreground">{{ t('calendar.start') }}</label>
        <input
          v-model="rescheduleDraft.time"
          data-testid="reschedule-start"
          type="time"
          class="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
        >
      </div>
      <div>
        <label class="mb-1 block text-[11px] text-muted-foreground">{{ t('calendar.end') }}</label>
        <input
          v-model="rescheduleDraft.endTime"
          data-testid="reschedule-end"
          type="time"
          class="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
        >
      </div>
    </div>
    <button
      :title="rescheduleConfirmDisabled() ? t('calendar.reschedule_invalid_time') : ''"
      :disabled="rescheduleConfirmDisabled() || undefined"
      data-testid="reschedule-confirm"
      class="mt-3 h-8 w-full rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      @click="rescheduleEvent(selectedEvent)"
    >
      {{ t('calendar.reschedule_confirm') }}
    </button>
  </div>
</div>
```

- [ ] **Step 5: Add `data-testid` hooks to event tile and detail time**

The test queries `[data-testid^="calendar-event-"]` and `[data-testid="event-detail-time"]`. Verify their presence:

Run: `grep -n 'data-testid="calendar-event-\|data-testid="event-detail-time"' src/features/calendar/components/CalendarPage.vue`

If missing, add them:
- On the day-view event tile button (around L580-583 where `@click="selectedEventId = event.id"` lives), add `:data-testid="\`calendar-event-${event.id}\`"`.
- On the detail panel time row (around L614 where `{{ selectedEvent.date }} {{ selectedEvent.time }}...` renders), wrap the inner span with `data-testid="event-detail-time"`.

The exact existing markup near L611-616:

```vue
<div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
  <div class="flex items-center gap-1.5">
    <Clock :size="12" />
    <span>{{ selectedEvent.date }} {{ selectedEvent.time }}{{ selectedEvent.endTime ? ` - ${selectedEvent.endTime}` : '' }}</span>
  </div>
```

Change the `<span>` opener to `<span data-testid="event-detail-time">`.

For the event tile, find the actual line (it may differ slightly from L582). Run:

`grep -n 'selectedEventId = event.id' src/features/calendar/components/CalendarPage.vue`

On the enclosing element (the one with `@click="selectedEventId = event.id"`), add `:data-testid="\`calendar-event-${event.id}\`"`.

- [ ] **Step 6: Add i18n keys**

In `src/locales/zh.json` under the `calendar` object, add:

```json
"reschedule_confirm": "确认重排",
"reschedule_invalid_time": "结束时间必须晚于开始时间",
"date": "日期",
"start": "开始",
"end": "结束",
```

Check whether `calendar.date / start / end` already exist before adding to avoid duplicate-key errors. Run:

`grep -n '"date":\|"start":\|"end":' src/locales/zh.json`

Add only the missing ones. Mirror with English values in `src/locales/en.json`: `"Reschedule"`, `"End time must be after start"`, `"Date"`, `"Start"`, `"End"`.

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm vitest run tests/components/CalendarPage.reschedule.test.ts`
Expected: 2 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/calendar/components/CalendarPage.vue src/locales/zh.json src/locales/en.json tests/components/CalendarPage.reschedule.test.ts
git commit -m "feat(calendar): wire reschedule button to inline date/time popover"
```

---

## Task 5: D · `appendMarkdown` in docsStore

**Files:**
- Modify: `src/features/docs/stores/docsStore.ts` — add `appendMarkdown` function, export from store return
- Test: extends Task 7's `DocsPage.import.test.ts` (we don't add a separate store unit test because `appendMarkdown` is a thin one-liner over `sendTextMessage`; integration coverage in Task 7 is sufficient under YAGNI)

- [ ] **Step 1: Add the function**

In `src/features/docs/stores/docsStore.ts`, locate the import line for `sendTextMessage` near the top of the file. Run:

`grep -n 'sendTextMessage\|from .@matrix' src/features/docs/stores/docsStore.ts`

If `sendTextMessage` is not yet imported, add to the existing matrix import (or alongside it):

```ts
import { sendTextMessage } from '@matrix/index'
```

(Use the exact same import path that other files in the project use for `sendTextMessage` — `tests/components/RichTextInput.send.test.ts:1` confirms it is `'@matrix/index'`.)

Then find the `createDocument` function (L735). Immediately after `createDocument` ends (around L797 — find the closing `}`), add:

```ts
  async function appendMarkdown(docId: string, markdown: string): Promise<void> {
    const trimmed = markdown.trim()
    if (!trimmed)
      return
    await sendTextMessage(docId, trimmed)
  }
```

Then find the store's return statement (L1054):

```ts
    createDocument,
```

Add immediately after:

```ts
    appendMarkdown,
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/docs/stores/docsStore.ts
git commit -m "feat(docs): add appendMarkdown to write initial body into doc room"
```

---

## Task 6: D · DocsCreateButton import wiring

**Files:**
- Modify: `src/features/docs/components/DocsCreateButton.vue`
- Modify: `src/locales/zh.json`, `src/locales/en.json` — add `docs.import_doc`
- Test: `tests/components/DocsCreateButton.import.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/components/DocsCreateButton.import.test.ts`:

```typescript
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import DocsCreateButton from '@/features/docs/components/DocsCreateButton.vue'

function makeFile(name: string, content: string): File {
  return new File([content], name, { type: 'text/markdown' })
}

describe('docsCreateButton import', () => {
  it('emits importDoc with the selected File and closes the menu', async () => {
    const wrapper = mount(DocsCreateButton, {
      global: { stubs: { Teleport: false } },
      attachTo: document.body,
    })
    await wrapper.find('button').trigger('click')
    await nextTick()

    const importButton = document.querySelector('[data-testid="docs-create-import"]') as HTMLButtonElement
    expect(importButton).toBeTruthy()

    const fileInput = wrapper.find('input[type="file"]').element as HTMLInputElement
    expect(fileInput).toBeTruthy()

    const file = makeFile('notes.md', '# Hello\n\nworld')
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
    fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()

    const emitted = wrapper.emitted('importDoc')
    expect(emitted).toBeTruthy()
    expect(emitted?.[0]?.[0]).toBe(file)

    expect(document.querySelector('[data-testid="docs-create-import"]')).toBeNull()
    wrapper.unmount()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/DocsCreateButton.import.test.ts`
Expected: FAIL — no `data-testid="docs-create-import"`, no file input, no `importDoc` emit.

- [ ] **Step 3: Implement the import wiring**

Replace the entire content of `src/features/docs/components/DocsCreateButton.vue` with:

```vue
<script setup lang="ts">
import { FilePlus2, FolderPlus, Upload } from 'lucide-vue-next'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{
  createDoc: []
  createFolder: []
  importDoc: [file: File]
}>()

const { t } = useI18n()
const open = ref(false)
const btnRef = ref<HTMLElement>()
const menuRef = ref<HTMLElement>()
const fileInput = ref<HTMLInputElement>()

function toggle() {
  open.value = !open.value
}

function handleCreateDoc() {
  open.value = false
  emit('createDoc')
}

function handleCreateFolder() {
  open.value = false
  emit('createFolder')
}

function triggerImport() {
  open.value = false
  fileInput.value?.click()
}

function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file)
    emit('importDoc', file)
  // reset so selecting the same file twice still fires change
  input.value = ''
}

function onClickOutside(e: MouseEvent) {
  if (!open.value)
    return
  const target = e.target as HTMLElement
  if (btnRef.value?.contains(target) || menuRef.value?.contains(target))
    return
  open.value = false
}

onMounted(() => document.addEventListener('pointerdown', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onClickOutside))
</script>

<template>
  <div ref="btnRef" class="relative mx-2 mb-4">
    <button
      class="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      @click="toggle"
    >
      <FilePlus2 :size="16" />
      <span>新建</span>
    </button>

    <input
      ref="fileInput"
      type="file"
      accept=".md,.markdown,.txt"
      class="hidden"
      @change="onFileChosen"
    >

    <Teleport to="body">
      <div
        v-if="open"
        ref="menuRef"
        class="fixed z-50 min-w-[160px] rounded-lg border border-border bg-card py-1 shadow-lg"
        :style="{ left: `${btnRef?.getBoundingClientRect().left ?? 0}px`, top: `${(btnRef?.getBoundingClientRect().bottom ?? 0) + 4}px` }"
      >
        <button
          class="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-foreground transition-colors hover:bg-accent"
          @click="handleCreateDoc"
        >
          <FilePlus2 :size="15" class="text-primary" />
          <span>新建文档</span>
        </button>
        <button
          class="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-foreground transition-colors hover:bg-accent"
          @click="handleCreateFolder"
        >
          <FolderPlus :size="15" class="text-amber-500" />
          <span>新建文件夹</span>
        </button>
        <div class="mx-2 my-1 h-px bg-border" />
        <button
          data-testid="docs-create-import"
          class="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent"
          @click="triggerImport"
        >
          <Upload :size="15" />
          <span>{{ t('docs.import_doc') }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>
```

- [ ] **Step 4: Add i18n key**

In `src/locales/zh.json` under the `docs` object, add:

```json
"import_doc": "导入文档",
```

In `src/locales/en.json` add:

```json
"import_doc": "Import document",
```

If a `docs` namespace does not exist in en.json, create it.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/components/DocsCreateButton.import.test.ts`
Expected: PASS.

- [ ] **Step 6: Sanity-check DocsPage still mounts**

Run: `pnpm vitest run tests/components/DocsPage.navigation.test.ts`
Expected: PASS — the new emit is purely additive and unlistened-to in the existing test.

- [ ] **Step 7: Commit**

```bash
git add src/features/docs/components/DocsCreateButton.vue src/locales/zh.json src/locales/en.json tests/components/DocsCreateButton.import.test.ts
git commit -m "feat(docs): add file import menu item to DocsCreateButton"
```

---

## Task 7: D · DocsPage import handler

**Files:**
- Modify: `src/features/docs/components/DocsPage.vue`
- Modify: `src/locales/zh.json`, `src/locales/en.json` — add `docs.import_too_large`
- Test: `tests/components/DocsPage.import.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/components/DocsPage.import.test.ts`:

```typescript
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { toast } from 'vue-sonner'
import DocsPage from '@/features/docs/components/DocsPage.vue'
import { useDocsStore } from '@/features/docs/stores/docsStore'

vi.mock('vue-sonner', () => ({
  toast: { error: vi.fn() },
}))

vi.mock('@/features/docs/components/DocsCreateButton.vue', () => ({
  default: defineComponent({
    name: 'DocsCreateButton',
    emits: ['createDoc', 'createFolder', 'importDoc'],
    setup(_, { emit, expose }) {
      expose({
        triggerImport: (file: File) => emit('importDoc', file),
      })
      return () => null
    },
  }),
}))

describe('docsPage import-doc handler', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('creates a document then appends the file body', async () => {
    const store = useDocsStore()
    const createDocument = vi.spyOn(store, 'createDocument').mockResolvedValue('!room:localhost')
    const appendMarkdown = vi.spyOn(store, 'appendMarkdown').mockResolvedValue()

    const wrapper = mount(DocsPage)
    await nextTick()

    const button = wrapper.findComponent({ name: 'DocsCreateButton' })
    const file = new File(['# Title\n\nbody'], 'note.md', { type: 'text/markdown' })
    ;(button.vm as { triggerImport: (file: File) => void }).triggerImport(file)
    await nextTick()
    // allow promise chain to settle
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(createDocument).toHaveBeenCalledTimes(1)
    const [title] = createDocument.mock.calls[0]!
    expect(title).toBe('note')

    expect(appendMarkdown).toHaveBeenCalledWith('!room:localhost', '# Title\n\nbody')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('rejects files larger than 1 MB without creating a document', async () => {
    const store = useDocsStore()
    const createDocument = vi.spyOn(store, 'createDocument')
    const appendMarkdown = vi.spyOn(store, 'appendMarkdown')

    const wrapper = mount(DocsPage)
    await nextTick()

    const button = wrapper.findComponent({ name: 'DocsCreateButton' })
    const big = new File([new Uint8Array(1024 * 1024 + 1)], 'big.md', { type: 'text/markdown' })
    ;(button.vm as { triggerImport: (file: File) => void }).triggerImport(big)
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(createDocument).not.toHaveBeenCalled()
    expect(appendMarkdown).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/DocsPage.import.test.ts`
Expected: FAIL — `DocsPage` does not handle `importDoc` yet.

- [ ] **Step 3: Add the handler to DocsPage**

Open `src/features/docs/components/DocsPage.vue`. Confirm `toast` and `useI18n` are imported (run `grep -n "import.*toast\|useI18n" src/features/docs/components/DocsPage.vue`); if absent, add:

```ts
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'
```

If `useI18n()` isn't already destructured, add near other composables:

```ts
const { t } = useI18n()
```

Then locate the existing `createDocument` function (around L71):

```ts
async function createDocument(): Promise<void> {
  const docId = await store.createDocument('新建协作文档', store.activeFolder)
  ...
}
```

Add directly below it:

```ts
const IMPORT_DOC_MAX_BYTES = 1024 * 1024

async function importDoc(file: File): Promise<void> {
  if (file.size > IMPORT_DOC_MAX_BYTES) {
    toast.error(t('docs.import_too_large'))
    return
  }
  const text = await file.text()
  const title = file.name.replace(/\.(md|markdown|txt)$/i, '') || t('docs.untitled_import')
  const docId = await store.createDocument(title, store.activeFolder)
  await store.appendMarkdown(docId, text)
}
```

- [ ] **Step 4: Wire the handler in template**

Search the template for `<DocsCreateButton`:

`grep -n 'DocsCreateButton' src/features/docs/components/DocsPage.vue`

On that element, add `@import-doc="importDoc"`. Example — if existing is:

```vue
<DocsCreateButton @create-doc="createDocument" @create-folder="..." />
```

Change to:

```vue
<DocsCreateButton @create-doc="createDocument" @create-folder="..." @import-doc="importDoc" />
```

- [ ] **Step 5: Add i18n keys**

In `src/locales/zh.json` under `docs`:

```json
"import_too_large": "文件过大，最多支持 1 MB",
"untitled_import": "导入的文档",
```

In `src/locales/en.json` under `docs`:

```json
"import_too_large": "File too large; max 1 MB",
"untitled_import": "Imported document",
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run tests/components/DocsPage.import.test.ts`
Expected: 2 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/docs/components/DocsPage.vue src/locales/zh.json src/locales/en.json tests/components/DocsPage.import.test.ts
git commit -m "feat(docs): handle import-doc by creating doc and appending file body"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `pnpm vitest run`
Expected: all tests pass; no new failures vs `main`.

- [ ] **Step 2: TypeScript check**

Run: `pnpm tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Lint (if configured)**

Run: `pnpm lint`
Expected: clean (or no new warnings vs baseline).

- [ ] **Step 4: Smoke run in dev**

Run: `pnpm dev` and verify in browser:
- Calendar → click an event → "重排" opens popover, change time, confirm → detail updates.
- Inbox → click "Defer" → "自定义延后" is collapsed by default; toggle expands it.
- Chat composer → expand composer → click ChevronDown → "静默发送" menu item appears → clicking it sends message and clears editor.
- Docs sidebar → "新建" → "导入文档" → pick a small `.md` → new doc appears with imported text.

- [ ] **Step 5: No commit needed** — all per-task commits are in place.

---

## Self-review checklist (already applied)

- [x] Spec section 3 (A reschedule) → Task 4
- [x] Spec section 4 (B custom defer) → Task 1
- [x] Spec section 5 (C silent send) → Tasks 2 + 3
- [x] Spec section 6 (D import) → Tasks 5 + 6 + 7
- [x] Spec section 7 (i18n keys) → woven into Tasks 3, 4, 6, 7
- [x] No "TBD" / "implement later" / "appropriate handling" anywhere
- [x] Every code step shows the exact code to write
- [x] Type names consistent: `RescheduleDraft`, `SendTextOptions`, `appendMarkdown`, `submitEditorSilent`, `customDeferOpenByItemId`, `IMPORT_DOC_MAX_BYTES`
- [x] Each task ends with a commit; no batched commits across tasks
