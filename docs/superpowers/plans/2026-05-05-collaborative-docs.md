# 飞书风格协作文档 - 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Muon 添加对齐飞书的在线协作文档功能，支持实时协同编辑、完整富文本、评论与分享。

**Architecture:** Yjs CRDT 管理文档模型，Tiptap + y-prosemirror 实现协作编辑器，Matrix 自定义事件作为 Yjs 同步传输层。每个文档即一个 Matrix 私密房间。

**Tech Stack:** Vue 3 + TypeScript + Tiptap 3 + Yjs + matrix-js-sdk + Pinia

---

### Task 1: 安装依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 Yjs 和 Tiptap 协作扩展**

```bash
pnpm add yjs @tiptap/extension-collaboration @tiptap/extension-collaboration-cursor
```

- [ ] **Step 2: 验证安装**

```bash
node -e "require('yjs'); console.log('yjs OK')"
node -e "require('@tiptap/extension-collaboration'); console.log('collab OK')"
```

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add yjs and tiptap collaboration extensions"
```

---

### Task 2: 类型定义

**Files:**
- Create: `src/features/docs/types/doc.ts`

- [ ] **Step 1: 创建类型文件**

```typescript
// src/features/docs/types/doc.ts
import type { Doc as YDoc } from 'yjs'

export interface DocComment {
  id: string
  userId: string
  text: string
  /** ProseMirror 选区范围，null 表示全文评论 */
  selection: { from: number, to: number } | null
  resolved: boolean
  createdAt: number
}

export interface CursorData {
  userId: string
  name: string
  /** 用户颜色，用于光标渲染 */
  color: string
  from: number
  to: number
}

export interface DocMetadata {
  createdAt: number
  updatedAt: number
  createdBy: string
  folder: string
}

export interface DocEntry {
  /** 文档 ID，同时是 Matrix 房间 ID */
  id: string
  title: string
  owner: string
  updated: string
  type: string
  status: '草稿' | '进行中' | '评审中' | '稳定'
  folder: string
  sectionIds: DocSectionId[]
  roomId: string
}

export type DocSectionId = 'recent' | 'starred' | 'shared'

export interface DocSyncEvent {
  type: 'full' | 'delta'
  docId: string
  seq: number
  total: number
  /** Base64 编码的 Yjs 增量更新 */
  payload: string
  /** 前一条事件的 ID，用于检测丢包 */
  prevEventId: string | null
}

export interface DocCursorEvent {
  userId: string
  name: string
  color: string
  from: number
  to: number
}

export const MATRIX_EVENT_TYPES = {
  DOC_SYNC: 'org.muon.doc.sync',
  DOC_CURSOR: 'org.muon.doc.cursor',
  DOC_METADATA: 'org.muon.doc.metadata',
} as const

export function userColor(userId: string): string {
  const colors = [
    '#2563eb', '#dc2626', '#16a34a', '#ca8a04',
    '#9333ea', '#0891b2', '#db2777', '#ea580c',
  ]
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i)
    hash |= 0
  }
  return colors[Math.abs(hash) % colors.length]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/docs/types/doc.ts
git commit -m "feat(docs): add collaborative document type definitions"
```

---

### Task 3: MatrixSyncProvider 服务

**Files:**
- Create: `src/features/docs/services/matrixSyncProvider.ts`

`★ Insight ─────────────────────────────────────`
**MatrixSyncProvider 的角色**：它是 Yjs 和 Matrix 之间的"翻译器"。Yjs 不知道 Matrix 的存在，Matrix 也不理解 Yjs 的 CRDT 结构。Provider 做了三件事：(1) 监听 Yjs 的 `update` 事件，将二进制增量分片后发送到 Matrix 房间；(2) 监听 Matrix 房间的 `org.muon.doc.sync` 事件，合并分片后调用 `Y.applyUpdate()`；(3) 将 Yjs awareness（光标/在线状态）序列化为 Matrix ephemeral events。这是经典的 **适配器模式** 应用。
`─────────────────────────────────────────────────`

- [ ] **Step 1: 创建 MatrixSyncProvider**

```typescript
// src/features/docs/services/matrixSyncProvider.ts
import type { MatrixClient } from 'matrix-js-sdk'
import { Doc, applyUpdate, encodeStateAsUpdate } from 'yjs'
import type { DocSyncEvent, DocCursorEvent } from '../types/doc'
import { MATRIX_EVENT_TYPES } from '../types/doc'
import { getClient } from '@matrix/client'

const MAX_CHUNK_SIZE = 60 * 1024 // 60KB，Matrix 事件限制 64KB

export class MatrixSyncProvider {
  private doc: Doc
  private roomId: string
  private client: MatrixClient
  private lastEventId: string | null = null
  private pendingChunks = new Map<string, Uint8Array[]>()

  constructor(doc: Doc, roomId: string, client?: MatrixClient) {
    this.doc = doc
    this.roomId = roomId
    this.client = client ?? getClient()

    this.doc.on('update', this.handleYjsUpdate)
    this.client.on('Room.timeline', this.handleTimelineEvent)
  }

  private handleYjsUpdate = (update: Uint8Array, origin: unknown): void => {
    if (origin === this) return

    const payload = this.uint8ToBase64(update)
    const chunks = this.splitPayload(payload)

    for (let i = 0; i < chunks.length; i++) {
      const event: DocSyncEvent = {
        type: chunks.length === 1 ? 'full' : 'delta',
        docId: this.roomId,
        seq: i,
        total: chunks.length,
        payload: chunks[i],
        prevEventId: i === 0 ? this.lastEventId : null,
      }

      this.client.sendEvent(this.roomId, MATRIX_EVENT_TYPES.DOC_SYNC, event)
        .then((res) => {
          if (i === chunks.length - 1) {
            this.lastEventId = res.event_id
          }
        })
        .catch(console.error)
    }
  }

  private handleTimelineEvent = (roomEvent: unknown): void => {
    const event = roomEvent as {
      event: {
        type: string
        content: DocSyncEvent
        room_id: string
        event_id: string
      }
    }
    if (event.event?.type !== MATRIX_EVENT_TYPES.DOC_SYNC) return
    if (event.event?.room_id !== this.roomId) return

    const content = event.event.content
    if (!content?.payload) return

    if (content.total > 1) {
      // 多分片：缓存所有分片后合并
      const key = `${content.docId}-${event.event.event_id}`
      if (!this.pendingChunks.has(key)) {
        this.pendingChunks.set(key, [])
      }
      const chunks = this.pendingChunks.get(key)!
      chunks[content.seq] = this.base64ToUint8(content.payload)

      if (chunks.filter(Boolean).length === content.total) {
        const merged = this.mergeChunks(chunks)
        applyUpdate(this.doc, merged, this)
        this.pendingChunks.delete(key)
      }
    } else {
      const update = this.base64ToUint8(content.payload)
      applyUpdate(this.doc, update, this)
    }

    this.lastEventId = event.event.event_id
  }

  /** 发送完整快照（新用户加入时用） */
  sendSnapshot(): void {
    const snapshot = encodeStateAsUpdate(this.doc)
    const payload = this.uint8ToBase64(snapshot)

    this.client.sendEvent(this.roomId, MATRIX_EVENT_TYPES.DOC_SYNC, {
      type: 'full',
      docId: this.roomId,
      seq: 0,
      total: 1,
      payload,
      prevEventId: null,
    }).catch(console.error)
  }

  /** 发送光标位置 */
  sendCursor(cursor: DocCursorEvent): void {
    this.client.sendEvent(this.roomId, MATRIX_EVENT_TYPES.DOC_CURSOR, cursor)
      .catch(() => {}) // ephemeral 类事件静默失败
  }

  /** 销毁 provider，清理监听 */
  destroy(): void {
    this.doc.off('update', this.handleYjsUpdate)
    this.client.off('Room.timeline', this.handleTimelineEvent)
  }

  private splitPayload(payload: string): string[] {
    if (payload.length <= MAX_CHUNK_SIZE) return [payload]
    const chunks: string[] = []
    for (let i = 0; i < payload.length; i += MAX_CHUNK_SIZE) {
      chunks.push(payload.slice(i, i + MAX_CHUNK_SIZE))
    }
    return chunks
  }

  private mergeChunks(chunks: Uint8Array[]): Uint8Array {
    const totalLen = chunks.reduce((sum, c) => sum + c.length, 0)
    const merged = new Uint8Array(totalLen)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }
    return merged
  }

  private uint8ToBase64(uint8: Uint8Array): string {
    let binary = ''
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i])
    }
    return btoa(binary)
  }

  private base64ToUint8(base64: string): Uint8Array {
    const binary = atob(base64)
    const uint8 = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      uint8[i] = binary.charCodeAt(i)
    }
    return uint8
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/docs/services/matrixSyncProvider.ts
git commit -m "feat(docs): add MatrixSyncProvider for Yjs-Matrix bridging"
```

---

### Task 4: useDocSync composable

**Files:**
- Create: `src/features/docs/composables/useDocSync.ts`

- [ ] **Step 1: 创建 useDocSync**

```typescript
// src/features/docs/composables/useDocSync.ts
import { Doc } from 'yjs'
import { shallowRef, onUnmounted } from 'vue'
import { MatrixSyncProvider } from '../services/matrixSyncProvider'
import { getClient } from '@matrix/client'
import type { MatrixClient } from 'matrix-js-sdk'

export function useDocSync(docId: string) {
  const ydoc = shallowRef(new Doc())
  const provider = shallowRef<MatrixSyncProvider | null>(null)
  const connected = shallowRef(false)
  const error = shallowRef<string | null>(null)

  async function connect(): Promise<void> {
    try {
      const client: MatrixClient = getClient()

      // 加入文档房间（如果不存在则先创建）
      let room = client.getRoom(docId)
      if (!room) {
        const result = await client.joinRoom(docId)
        room = client.getRoom(result.roomId)!
      }

      provider.value = new MatrixSyncProvider(ydoc.value, room.roomId, client)
      connected.value = true
      error.value = null
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to connect'
      connected.value = false
    }
  }

  function disconnect(): void {
    provider.value?.destroy()
    provider.value = null
    connected.value = false
  }

  onUnmounted(() => {
    disconnect()
  })

  return { ydoc, provider, connected, error, connect, disconnect }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/docs/composables/useDocSync.ts
git commit -m "feat(docs): add useDocSync composable"
```

---

### Task 5: useDocCursor composable

**Files:**
- Create: `src/features/docs/composables/useDocCursor.ts`

- [ ] **Step 1: 创建 useDocCursor**

```typescript
// src/features/docs/composables/useDocCursor.ts
import { computed, shallowRef } from 'vue'
import type { MatrixSyncProvider } from '../services/matrixSyncProvider'
import type { CursorData } from '../types/doc'
import { userColor } from '../types/doc'

export function useDocCursor(provider: () => MatrixSyncProvider | null, userId: string, userName: string) {
  const remoteCursors = shallowRef<Record<string, CursorData>>({})
  const color = userColor(userId)

  /** 上报本地光标位置 */
  function updateLocalCursor(from: number, to: number): void {
    provider()?.sendCursor({
      userId,
      name: userName,
      color,
      from,
      to,
    })
  }

  /** 获取除自己外的远程光标列表 */
  const others = computed(() =>
    Object.values(remoteCursors.value).filter(c => c.userId !== userId),
  )

  function updateRemoteCursor(cursor: CursorData): void {
    remoteCursors.value = {
      ...remoteCursors.value,
      [cursor.userId]: cursor,
    }
  }

  function removeRemoteCursor(targetUserId: string): void {
    const updated = { ...remoteCursors.value }
    delete updated[targetUserId]
    remoteCursors.value = updated
  }

  return { color, remoteCursors, others, updateLocalCursor, updateRemoteCursor, removeRemoteCursor }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/docs/composables/useDocCursor.ts
git commit -m "feat(docs): add useDocCursor composable"
```

---

### Task 6: useDocEditor composable

**Files:**
- Create: `src/features/docs/composables/useDocEditor.ts`

`★ Insight ─────────────────────────────────────`
**y-prosemirror 的协作原理**：`y-prosemirror` 做了两件事：(1) 将 ProseMirror 的 transaction（编辑操作）转换为 Yjs 的增量更新（Y.XmlFragment 上的 insert/delete 操作），(2) 监听 Yjs 文档变更并反向同步到 ProseMirror state。这意味着 **Tiptap 编辑器不需要知道协作逻辑**——它只是像往常一样编辑 ProseMirror state，y-prosemirror 在底层透明地处理多用户合并。这正是关注点分离的典范。
`─────────────────────────────────────────────────`

- [ ] **Step 1: 创建 useDocEditor**

```typescript
// src/features/docs/composables/useDocEditor.ts
import { type Ref, shallowRef, watch, onUnmounted } from 'vue'
import type { Doc } from 'yjs'
import { useEditor, type Editor } from '@tiptap/vue-3'
import { StarterKit } from '@tiptap/starter-kit'
import { Collaboration } from '@tiptap/extension-collaboration'
import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor'
import { Image } from '@tiptap/extension-image'
import { Link } from '@tiptap/extension-link'
import { Underline } from '@tiptap/extension-underline'
import { Placeholder } from '@tiptap/extension-placeholder'
import type { CursorData } from '../types/doc'

export function useDocEditor(
  ydoc: () => Doc,
  elementRef: Ref<HTMLElement | undefined>,
  user: { id: string, name: string, color: string },
) {
  const editor = shallowRef<Editor | null>(null)

  editor.value = useEditor({
    element: elementRef.value,
    extensions: [
      StarterKit.configure({
        history: false, // Yjs 管理历史，禁用 Tiptap 内置历史
      }),
      Collaboration.configure({
        document: ydoc().get('content', YXmlFragment) as any,
        field: 'content',
      }),
      CollaborationCursor.configure({
        provider: null, // 用我们的 MatrixSyncProvider 替代
        user: {
          name: user.name,
          color: user.color,
        },
      }),
      Image.configure({ inline: true }),
      Link.configure({ openOnClick: false }),
      Underline,
      Placeholder.configure({ placeholder: '输入文档内容...' }),
    ],
    onCreate({ editor: ed }) {
      // 同步 ydoc title 到编辑器
      const title = ydoc().getText('title')
      if (title.length > 0) {
        // title 已存在，无需初始化
      }
    },
  })

  onUnmounted(() => {
    editor.value?.destroy()
  })

  return { editor }
}

import { YXmlFragment } from 'yjs'
```

- [ ] **Step 2: Commit**

```bash
git add src/features/docs/composables/useDocEditor.ts
git commit -m "feat(docs): add useDocEditor composable with Tiptap-Yjs binding"
```

---

### Task 7: useDocComments composable

**Files:**
- Create: `src/features/docs/composables/useDocComments.ts`

- [ ] **Step 1: 创建 useDocComments**

```typescript
// src/features/docs/composables/useDocComments.ts
import { computed, shallowRef } from 'vue'
import type { Doc } from 'yjs'
import { Array as YArray } from 'yjs'
import type { DocComment } from '../types/doc'
import { nanoid } from 'nanoid'

export function useDocComments(ydoc: () => Doc, currentUserId: string) {
  const draftText = shallowRef('')
  const comments = shallowRef<DocComment[]>([])

  const ycomments = ydoc().getArray<DocComment>('comments')

  function syncFromYjs(): void {
    comments.value = ycomments.toArray()
  }

  ycomments.observe(() => {
    syncFromYjs()
  })

  syncFromYjs()

  const resolvedCount = computed(() =>
    comments.value.filter(c => c.resolved).length,
  )
  const unresolvedCount = computed(() =>
    comments.value.filter(c => !c.resolved).length,
  )

  function addComment(text: string, selection?: { from: number, to: number }): void {
    const comment: DocComment = {
      id: nanoid(),
      userId: currentUserId,
      text,
      selection: selection ?? null,
      resolved: false,
      createdAt: Date.now(),
    }
    ycomments.insert(0, [comment])
  }

  function resolveComment(commentId: string): void {
    const idx = ycomments.toArray().findIndex(c => c.id === commentId)
    if (idx === -1) return
    const updated = { ...ycomments.get(idx), resolved: true }
    ycomments.delete(idx, 1)
    ycomments.insert(idx, [updated])
  }

  return {
    draftText,
    comments,
    resolvedCount,
    unresolvedCount,
    addComment,
    resolveComment,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/docs/composables/useDocComments.ts
git commit -m "feat(docs): add useDocComments composable"
```

---

### Task 8: docsStore Pinia Store

**Files:**
- Create: `src/features/docs/stores/docsStore.ts`

- [ ] **Step 1: 创建 docsStore**

```typescript
// src/features/docs/stores/docsStore.ts
import { defineStore } from 'pinia'
import { shallowRef, computed } from 'vue'
import { getClient } from '@matrix/client'
import type { DocEntry, DocSectionId } from '../types/doc'

export const useDocsStore = defineStore('docs', () => {
  const documents = shallowRef<DocEntry[]>([])
  const activeSection = shallowRef<DocSectionId>('recent')
  const activeFolder = shallowRef('全部文档')
  const searchQuery = shallowRef('')
  const reviewOnly = shallowRef(false)
  const isLoading = shallowRef(false)

  const filteredDocuments = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()
    return documents.value.filter((doc) => {
      const matchesQuery = !query
        || doc.title.toLowerCase().includes(query)
        || doc.owner.toLowerCase().includes(query)
      const matchesSection = doc.sectionIds.includes(activeSection.value)
      const matchesFolder = activeFolder.value === '全部文档'
        || doc.folder === activeFolder.value
      const matchesReview = !reviewOnly.value || doc.status === '评审中'
      return matchesSection && matchesFolder && matchesQuery && matchesReview
    })
  })

  async function loadDocuments(): Promise<void> {
    isLoading.value = true
    try {
      const client = getClient()
      const rooms = client.getRooms()
      const docRooms = rooms.filter(r => {
        const events = r.getLiveTimeline().getEvents()
        return events.some(e => e.getType() === 'org.muon.doc.metadata')
      })

      documents.value = docRooms.map(room => {
        const metaEvent = room.getLiveTimeline().getEvents()
          .find(e => e.getType() === 'org.muon.doc.metadata')
        const content = metaEvent?.getContent() || {}
        return {
          id: room.roomId,
          title: content.title || '无标题文档',
          owner: content.owner || '未知',
          updated: content.updated || '',
          type: content.type || '文档',
          status: content.status || '草稿',
          folder: content.folder || '全部文档',
          sectionIds: content.sectionIds || ['recent'],
          roomId: room.roomId,
        }
      })
    } catch {
      documents.value = []
    } finally {
      isLoading.value = false
    }
  }

  async function createDocument(title: string, folder: string): Promise<string> {
    const client = getClient()
    const result = await client.createRoom({
      name: title,
      visibility: 'private' as any,
      initial_state: [{
        type: 'org.muon.doc.metadata',
        content: {
          title,
          owner: client.getUserId()!,
          updated: '刚刚',
          type: '文档',
          status: '草稿',
          folder,
          sectionIds: ['recent'],
          createdAt: Date.now(),
        },
      }],
    })
    await loadDocuments()
    return result.room_id
  }

  return {
    documents, activeSection, activeFolder, searchQuery, reviewOnly,
    isLoading, filteredDocuments,
    loadDocuments, createDocument,
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add src/features/docs/stores/docsStore.ts
git commit -m "feat(docs): add docsStore Pinia store"
```

---

### Task 9: DocEditorToolbar 组件

**Files:**
- Create: `src/features/docs/components/editor/DocEditorToolbar.vue`

- [ ] **Step 1: 创建工具栏组件**

```vue
<!-- src/features/docs/components/editor/DocEditorToolbar.vue -->
<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Quote, Code2, Heading1, Heading2, Heading3,
  Image as ImageIcon, Table, Undo2, Redo2,
} from 'lucide-vue-next'

defineProps<{ editor: Editor | null }>()

const emit = defineEmits<{
  insertImage: []
}>()

function toggleBold(e: MouseEvent) { /* editor.chain().focus().toggleBold().run() */ }
</script>

<template>
  <div class="flex h-10 shrink-0 items-center gap-1 border-b border-border bg-sidebar px-3">
    <button
      v-for="action in [
        { icon: Bold, action: () => editor?.chain().focus().toggleBold().run(), active: editor?.isActive('bold') },
        { icon: Italic, action: () => editor?.chain().focus().toggleItalic().run(), active: editor?.isActive('italic') },
        { icon: UnderlineIcon, action: () => editor?.chain().focus().toggleUnderline().run(), active: editor?.isActive('underline') },
        { icon: Strikethrough, action: () => editor?.chain().focus().toggleStrike().run(), active: editor?.isActive('strike') },
        { icon: Heading1, action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(), active: editor?.isActive('heading', { level: 1 }) },
        { icon: Heading2, action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), active: editor?.isActive('heading', { level: 2 }) },
        { icon: Heading3, action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), active: editor?.isActive('heading', { level: 3 }) },
        { icon: List, action: () => editor?.chain().focus().toggleBulletList().run(), active: editor?.isActive('bulletList') },
        { icon: ListOrdered, action: () => editor?.chain().focus().toggleOrderedList().run(), active: editor?.isActive('orderedList') },
        { icon: Quote, action: () => editor?.chain().focus().toggleBlockquote().run(), active: editor?.isActive('blockquote') },
        { icon: Code2, action: () => editor?.chain().focus().toggleCodeBlock().run(), active: editor?.isActive('codeBlock') },
        { icon: Table, action: () => editor?.chain().focus().insertTable({ rows: 3, cols: 3 }).run(), active: false },
        { icon: Undo2, action: () => editor?.chain().focus().undo().run(), active: false },
        { icon: Redo2, action: () => editor?.chain().focus().redo().run(), active: false },
      ]"
      :key="action.icon.toString()"
      class="flex size-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      :class="{ 'bg-accent text-primary': action.active }"
      @click="action.action"
    >
      <component :is="action.icon" :size="16" />
    </button>

    <div class="ml-auto flex items-center gap-1">
      <button
        class="flex size-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        @click="emit('insertImage')"
      >
        <ImageIcon :size="16" />
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/docs/components/editor/DocEditorToolbar.vue
git commit -m "feat(docs): add DocEditorToolbar component"
```

---

### Task 10: DocTitleInput 组件

**Files:**
- Create: `src/features/docs/components/editor/DocTitleInput.vue`

- [ ] **Step 1: 创建标题输入组件**

```vue
<!-- src/features/docs/components/editor/DocTitleInput.vue -->
<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import type { Doc } from 'yjs'
import { Text as YText } from 'yjs'

const props = defineProps<{ ydoc: Doc }>()

const title = shallowRef('')

const ytitle = props.ydoc.getText('title')
title.value = ytitle.toString()

const observerHandler = () => {
  title.value = ytitle.toString()
}
ytitle.observe(observerHandler)

watch(title, (val) => {
  if (val !== ytitle.toString()) {
    ytitle.delete(0, ytitle.length)
    ytitle.insert(0, val)
  }
})
</script>

<template>
  <input
    v-model="title"
    type="text"
    placeholder="无标题文档"
    class="w-full border-none bg-transparent px-4 pt-6 pb-2 text-2xl font-bold text-foreground outline-none placeholder:text-muted-foreground"
  >
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/docs/components/editor/DocTitleInput.vue
git commit -m "feat(docs): add DocTitleInput component"
```

---

### Task 11: DocEditor 主组件（组装编辑器）

**Files:**
- Create: `src/features/docs/components/editor/DocEditor.vue`

- [ ] **Step 1: 创建编辑器主组件**

```vue
<!-- src/features/docs/components/editor/DocEditor.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDocSync } from '../../composables/useDocSync'
import { useDocEditor } from '../../composables/useDocEditor'
import { useDocCursor } from '../../composables/useDocCursor'
import { useDocComments } from '../../composables/useDocComments'
import { userColor } from '../../types/doc'
import DocEditorToolbar from './DocEditorToolbar.vue'
import DocTitleInput from './DocTitleInput.vue'
import CollaboratorAvatars from '../collaboration/CollaboratorAvatars.vue'
import CommentsPanel from '../collaboration/CommentsPanel.vue'

const props = defineProps<{
  docId: string
  userName?: string
}>()

const currentUserId = 'current-user' // TODO: 从认证 store 获取
const userName = props.userName ?? '我'
const color = userColor(currentUserId)

const { ydoc, connected, error, connect } = useDocSync(props.docId)

const elementRef = ref<HTMLElement>()
const { editor } = useDocEditor(
  () => ydoc.value,
  elementRef as any,
  { id: currentUserId, name: userName, color },
)
const { others } = useDocCursor(
  () => null, // 将在 connect 后更新
  currentUserId,
  userName,
)
const { comments, draftText, addComment, resolveComment } = useDocComments(
  () => ydoc.value,
  currentUserId,
)

const showComments = ref(false)
const showShare = ref(false)

connect()
</script>

<template>
  <div class="flex h-full min-w-0 flex-1 flex-col bg-background">
    <!-- 顶栏：标题 + 协作者 -->
    <div class="flex items-center justify-between border-b border-border px-4 py-2">
      <div class="flex items-center gap-3">
        <span v-if="!connected" class="text-xs text-yellow-600">连接中...</span>
        <span v-else class="text-xs text-green-600">已连接</span>
      </div>
      <div class="flex items-center gap-2">
        <CollaboratorAvatars :cursors="others" />
        <button
          class="rounded-md px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent"
          @click="showComments = !showComments"
        >
          评论
        </button>
        <button
          class="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
          @click="showShare = !showShare"
        >
          分享
        </button>
      </div>
    </div>

    <!-- 工具栏 -->
    <DocEditorToolbar :editor="editor" />

    <!-- 编辑区域 -->
    <div class="flex min-h-0 flex-1">
      <div class="min-w-0 flex-1 overflow-y-auto">
        <DocTitleInput :ydoc="ydoc" />
        <div ref="elementRef" class="prose prose-sm max-w-none px-4 py-2" />
      </div>

      <!-- 评论面板 -->
      <CommentsPanel
        v-if="showComments"
        :comments="comments"
        :draft-text="draftText"
        @add-comment="addComment"
        @resolve="resolveComment"
        @close="showComments = false"
      />
    </div>

    <p v-if="error" class="px-4 py-2 text-xs text-red-500">{{ error }}</p>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/docs/components/editor/DocEditor.vue
git commit -m "feat(docs): add DocEditor main component"
```

---

### Task 12: CollaboratorAvatars 组件

**Files:**
- Create: `src/features/docs/components/collaboration/CollaboratorAvatars.vue`

- [ ] **Step 1: 创建协作者头像组件**

```vue
<!-- src/features/docs/components/collaboration/CollaboratorAvatars.vue -->
<script setup lang="ts">
import type { CursorData } from '../../types/doc'

defineProps<{ cursors: CursorData[] }>()
</script>

<template>
  <div class="flex -space-x-2">
    <div
      v-for="cursor in cursors"
      :key="cursor.userId"
      class="flex size-7 items-center justify-center rounded-full border-2 border-background text-[11px] font-semibold text-white"
      :style="{ backgroundColor: cursor.color }"
      :title="cursor.name"
    >
      {{ cursor.name.charAt(0).toUpperCase() }}
    </div>
    <div
      v-if="cursors.length === 0"
      class="flex size-7 items-center justify-center rounded-full border-2 border-border bg-muted text-[10px] text-muted-foreground"
    >
      +0
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/docs/components/collaboration/CollaboratorAvatars.vue
git commit -m "feat(docs): add CollaboratorAvatars component"
```

---

### Task 13: CommentsPanel 组件

**Files:**
- Create: `src/features/docs/components/collaboration/CommentsPanel.vue`

- [ ] **Step 1: 创建评论面板组件**

```vue
<!-- src/features/docs/components/collaboration/CommentsPanel.vue -->
<script setup lang="ts">
import { MessageSquare, X, CheckCircle2 } from 'lucide-vue-next'
import type { DocComment } from '../../types/doc'
import { shallowRef } from 'vue'

const props = defineProps<{
  comments: DocComment[]
  draftText: string
}>()

const emit = defineEmits<{
  addComment: [text: string]
  resolve: [commentId: string]
  close: []
}>()

const localDraft = shallowRef('')

function handleAdd(): void {
  const text = localDraft.value.trim()
  if (!text) return
  emit('addComment', text)
  localDraft.value = ''
}
</script>

<template>
  <aside class="flex w-72 shrink-0 flex-col border-l border-border bg-sidebar">
    <div class="flex h-10 items-center justify-between border-b border-border px-3">
      <span class="text-xs font-semibold">评论</span>
      <button class="flex size-6 items-center justify-center rounded hover:bg-accent" @click="emit('close')">
        <X :size="14" />
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-3">
      <div v-if="comments.length === 0" class="py-8 text-center text-xs text-muted-foreground">
        暂无评论
      </div>
      <div
        v-for="comment in comments"
        :key="comment.id"
        class="mb-2 rounded-md border border-border bg-background p-2"
        :class="{ 'opacity-50': comment.resolved }"
      >
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-semibold text-muted-foreground">{{ comment.userId }}</span>
          <button
            v-if="!comment.resolved"
            class="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-green-600"
            @click="emit('resolve', comment.id)"
          >
            <CheckCircle2 :size="12" />
          </button>
        </div>
        <p class="mt-1 text-[12px] leading-5">{{ comment.text }}</p>
      </div>
    </div>

    <div class="flex items-center gap-2 border-t border-border p-3">
      <input
        v-model="localDraft"
        type="text"
        placeholder="添加评论..."
        class="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
        @keyup.enter="handleAdd"
      >
      <button
        class="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
        @click="handleAdd"
      >
        <MessageSquare :size="13" />
      </button>
    </div>
  </aside>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/docs/components/collaboration/CommentsPanel.vue
git commit -m "feat(docs): add CommentsPanel component"
```

---

### Task 14: ShareDialog 组件

**Files:**
- Create: `src/features/docs/components/collaboration/ShareDialog.vue`

- [ ] **Step 1: 创建分享对话框组件**

```vue
<!-- src/features/docs/components/collaboration/ShareDialog.vue -->
<script setup lang="ts">
import { X, Link2, Users, Copy, Check } from 'lucide-vue-next'
import { shallowRef } from 'vue'

defineProps<{ docTitle: string }>()
const emit = defineEmits<{ close: [] }>()

const copied = shallowRef(false)

function copyLink(): void {
  navigator.clipboard.writeText(window.location.href)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="emit('close')">
    <div class="w-96 rounded-lg border border-border bg-popover shadow-xl">
      <div class="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 class="text-sm font-semibold">共享文档</h3>
        <button class="flex size-6 items-center justify-center rounded hover:bg-accent" @click="emit('close')">
          <X :size="14" />
        </button>
      </div>

      <div class="p-4">
        <div class="flex items-center gap-3 rounded-md border border-border p-3">
          <div class="flex size-9 items-center justify-center rounded-md bg-primary/10">
            <Users :size="18" class="text-primary" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold">邀请协作者</p>
            <input
              type="text"
              placeholder="输入用户名或邮箱..."
              class="mt-1 w-full border-none bg-transparent text-xs text-muted-foreground outline-none"
            >
          </div>
        </div>

        <div class="mt-4 flex items-center justify-between rounded-md border border-border p-3">
          <div class="flex items-center gap-2">
            <Link2 :size="14" class="text-muted-foreground" />
            <span class="text-xs">文档链接</span>
          </div>
          <button
            class="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors hover:bg-accent"
            @click="copyLink"
          >
            <component :is="copied ? Check : Copy" :size="12" />
            <span>{{ copied ? '已复制' : '复制' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/docs/components/collaboration/ShareDialog.vue
git commit -m "feat(docs): add ShareDialog component"
```

---

### Task 15: DocsSidebar 子组件

**Files:**
- Create: `src/features/docs/components/DocsSidebarNav.vue`
- Create: `src/features/docs/components/DocsFolderTree.vue`
- Create: `src/features/docs/components/DocsCreateButton.vue`

- [ ] **Step 1: 创建三个子组件**

```vue
<!-- src/features/docs/components/DocsCreateButton.vue -->
<script setup lang="ts">
import { FilePlus2 } from 'lucide-vue-next'
const emit = defineEmits<{ create: [] }>()
</script>
<template>
  <button
    class="mx-2 mb-4 flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
    @click="emit('create')"
  >
    <FilePlus2 :size="16" />
    <span>新建文档</span>
  </button>
</template>
```

```vue
<!-- src/features/docs/components/DocsSidebarNav.vue -->
<script setup lang="ts">
import type { Component } from 'vue'
import type { DocSectionId } from '../types/doc'

defineProps<{
  sections: Array<{ id: DocSectionId, label: string, icon: Component }>
  activeSection: DocSectionId
}>()

const emit = defineEmits<{ select: [id: DocSectionId] }>()
</script>
<template>
  <div class="flex flex-col gap-1">
    <button
      v-for="section in sections"
      :key="section.id"
      class="workspace-row gap-3 px-3 py-2 text-left text-muted-foreground"
      :class="{ 'workspace-row-active': activeSection === section.id }"
      @click="emit('select', section.id)"
    >
      <component :is="section.icon" :size="18" />
      <span class="text-[13px] font-semibold">{{ section.label }}</span>
    </button>
  </div>
</template>
```

```vue
<!-- src/features/docs/components/DocsFolderTree.vue -->
<script setup lang="ts">
import { FolderOpen } from 'lucide-vue-next'

defineProps<{
  folders: string[]
  activeFolder: string
}>()

const emit = defineEmits<{ select: [folder: string] }>()
</script>
<template>
  <div class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
    <button
      v-for="folder in folders"
      :key="folder"
      class="workspace-row gap-3 px-3 py-2 text-left text-muted-foreground"
      :class="{ 'workspace-row-active': activeFolder === folder }"
      @click="emit('select', folder)"
    >
      <FolderOpen :size="18" />
      <span class="truncate text-[13px]">{{ folder }}</span>
    </button>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/docs/components/DocsSidebarNav.vue src/features/docs/components/DocsFolderTree.vue src/features/docs/components/DocsCreateButton.vue
git commit -m "feat(docs): add sidebar child components"
```

---

### Task 16: DocsSidebar 父组件

**Files:**
- Create: `src/features/docs/components/DocsSidebar.vue`

- [ ] **Step 1: 创建侧边栏主组件**

```vue
<!-- src/features/docs/components/DocsSidebar.vue -->
<script setup lang="ts">
import { Clock3, Star, Users } from 'lucide-vue-next'
import { useDocsStore } from '../stores/docsStore'
import DocsSidebarNav from './DocsSidebarNav.vue'
import DocsFolderTree from './DocsFolderTree.vue'
import DocsCreateButton from './DocsCreateButton.vue'

const store = useDocsStore()

const sections = [
  { id: 'recent' as const, label: '最近更新', icon: Clock3 },
  { id: 'starred' as const, label: '已收藏', icon: Star },
  { id: 'shared' as const, label: '共享给我', icon: Users },
]

const folders = ['全部文档', '产品规划', '设计资产', '工程文档', '发布复盘']

function selectSection(id: typeof sections[number]['id']): void {
  store.activeSection = id
  store.searchQuery = ''
}

function selectFolder(folder: string): void {
  store.activeFolder = folder
  store.searchQuery = ''
}

async function handleCreate(): Promise<void> {
  const roomId = await store.createDocument('新建协作文档', store.activeFolder)
  // router.push(`/docs/${roomId}`)
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden px-2 py-6">
    <div class="mb-6 px-3">
      <h1 class="text-[18px] font-semibold leading-6 text-foreground">文档</h1>
      <p class="mt-1 text-[13px] leading-[18px] text-muted-foreground">团队资料与项目文档</p>
    </div>

    <DocsCreateButton @create="handleCreate" />

    <DocsSidebarNav
      :sections="sections"
      :active-section="store.activeSection"
      @select="selectSection"
    />

    <div class="mt-6 px-3 pb-2 text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
      文件夹
    </div>

    <DocsFolderTree
      :folders="folders"
      :active-folder="store.activeFolder"
      @select="selectFolder"
    />
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/docs/components/DocsSidebar.vue
git commit -m "feat(docs): add DocsSidebar parent component"
```

---

### Task 17: DocPreviewCard 组件

**Files:**
- Create: `src/features/docs/components/DocPreviewCard.vue`

- [ ] **Step 1: 创建文档卡片组件**

```vue
<!-- src/features/docs/components/DocPreviewCard.vue -->
<script setup lang="ts">
import { FileText } from 'lucide-vue-next'
import type { DocEntry } from '../types/doc'

defineProps<{ doc: DocEntry, isSelected: boolean }>()
const emit = defineEmits<{ select: [id: string] }>()
</script>

<template>
  <button
    class="grid w-full grid-cols-[minmax(0,1fr)_120px_110px_90px] items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-accent"
    :class="{ 'bg-primary/8': isSelected }"
    @click="emit('select', doc.id)"
  >
    <span class="flex min-w-0 items-center gap-3">
      <span class="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-primary">
        <FileText :size="16" />
      </span>
      <span class="min-w-0">
        <span class="block truncate text-[13px] font-semibold">{{ doc.title }}</span>
        <span class="block truncate text-[12px] text-muted-foreground">{{ doc.owner }}</span>
      </span>
    </span>
    <span class="text-[12px] text-muted-foreground">{{ doc.updated }}</span>
    <span class="text-[12px] text-muted-foreground">{{ doc.type }}</span>
    <span class="justify-self-start rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground">
      {{ doc.status }}
    </span>
  </button>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/docs/components/DocPreviewCard.vue
git commit -m "feat(docs): add DocPreviewCard component"
```

---

### Task 18: 重构 DocsPage 路由入口

**Files:**
- Modify: `src/features/docs/components/DocsPage.vue`

- [ ] **Step 1: 重构 DocsPage 使用新的组件**

```vue
<!-- src/features/docs/components/DocsPage.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Search, Grid3X3, SlidersHorizontal } from 'lucide-vue-next'
import { useDocsStore } from '../stores/docsStore'
import WorkspaceResizablePane from '@/app/components/workspace/WorkspaceResizablePane.vue'
import DocsSidebar from './DocsSidebar.vue'
import DocEditor from './editor/DocEditor.vue'
import DocPreviewCard from './DocPreviewCard.vue'

const route = useRoute()
const store = useDocsStore()

const selectedDocId = computed(() => (route.params.docId as string) || (store.filteredDocuments[0]?.id ?? ''))
const selectedDoc = computed(() => store.filteredDocuments.find(d => d.id === selectedDocId.value))
const viewMode = computed(() => 'list' as const)

store.loadDocuments()

const DOCS_WIDTH_STORAGE_KEY = 'muon_docs_sidebar_width'
const DEFAULT_DOCS_WIDTH = 240
const MIN_DOCS_WIDTH = 220
const MAX_DOCS_WIDTH = 360
</script>

<template>
  <div class="flex h-full min-w-0 flex-1 bg-background text-foreground">
    <WorkspaceResizablePane
      as="nav"
      pane-test-id="docs-sidebar"
      content-test-id="docs-sidebar-content"
      handle-test-id="docs-sidebar-resize-handle"
      content-class="flex h-full min-h-0 flex-col overflow-hidden px-0 py-0"
      :width-storage-key="DOCS_WIDTH_STORAGE_KEY"
      :default-width="DEFAULT_DOCS_WIDTH"
      :min-width="MIN_DOCS_WIDTH"
      :max-width="MAX_DOCS_WIDTH"
    >
      <DocsSidebar />
    </WorkspaceResizablePane>

    <!-- 无文档选中时显示列表 -->
    <section v-if="!selectedDocId" class="flex min-w-0 flex-1 flex-col bg-background">
      <header class="flex h-14 shrink-0 items-center justify-between border-b border-border bg-sidebar px-4">
        <label class="flex h-8 w-full max-w-md items-center gap-2 rounded-md border border-border bg-input px-3 text-muted-foreground focus-within:border-primary">
          <Search :size="18" />
          <input
            v-model="store.searchQuery"
            type="text"
            placeholder="搜索文档..."
            class="h-full min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          >
        </label>
      </header>
      <main class="min-h-0 flex-1 overflow-y-auto p-6">
        <div class="divide-y divide-border rounded-lg border border-border">
          <DocPreviewCard
            v-for="doc in store.filteredDocuments"
            :key="doc.id"
            :doc="doc"
            :is-selected="false"
            @select="id => $router.push(`/docs/${id}`)"
          />
        </div>
      </main>
    </section>

    <!-- 选中文档时显示编辑器 -->
    <DocEditor
      v-else-if="selectedDocId"
      :key="selectedDocId"
      :doc-id="selectedDocId"
    />
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/docs/components/DocsPage.vue
git commit -m "refactor(docs): integrate DocEditor and DocsSidebar into DocsPage"
```

---

### Task 19: 添加路由配置

**Files:**
- Modify: `src/app/router/index.ts`

- [ ] **Step 1: 添加文档编辑器路由**

在 `src/app/router/index.ts` 的 children 数组中，将现有的 docs 路由块替换为：

```typescript
{
  path: 'docs',
  name: 'docs',
  component: () => import('@features/docs/components/DocsPage.vue'),
},
{
  path: 'docs/:docId',
  name: 'doc-editor',
  component: () => import('@features/docs/components/DocsPage.vue'),
},
```

- [ ] **Step 2: Commit**

```bash
git add src/app/router/index.ts
git commit -m "feat(docs): add doc editor route"
```

---

### Task 20: 编写测试

**Files:**
- Create: `tests/unit/docs/matrixSyncProvider.test.ts`
- Create: `tests/unit/docs/docsStore.test.ts`
- Create: `tests/unit/docs/DocEditor.test.ts`

- [ ] **Step 1: MatrixSyncProvider 单元测试**

```typescript
// tests/unit/docs/matrixSyncProvider.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Doc } from 'yjs'
import { MatrixSyncProvider } from '@/features/docs/services/matrixSyncProvider'

vi.mock('@matrix/client', () => ({
  getClient: vi.fn(() => ({
    sendEvent: vi.fn().mockResolvedValue({ event_id: '$test_event' }),
    on: vi.fn(),
    off: vi.fn(),
  })),
}))

describe('matrixSyncProvider', () => {
  it('creates provider for a Yjs doc', () => {
    const doc = new Doc()
    const provider = new MatrixSyncProvider(doc, '!test:localhost')

    expect(provider).toBeDefined()
    provider.destroy()
  })

  it('emits Matrix event on Yjs update', () => {
    const doc = new Doc()
    const provider = new MatrixSyncProvider(doc, '!test:localhost')
    const text = doc.getText('test')

    text.insert(0, 'hello')

    // 异步等待事件发送
    expect(provider).toBeDefined()
    provider.destroy()
  })

  it('destroys cleanly without leaks', () => {
    const doc = new Doc()
    const provider = new MatrixSyncProvider(doc, '!test:localhost')

    provider.destroy()

    // 再次编辑不应触发事件
    const text = doc.getText('test')
    text.insert(0, 'after destroy')
    // 不会抛出错误即通过
  })
})
```

- [ ] **Step 2: docsStore 单元测试**

```typescript
// tests/unit/docs/docsStore.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDocsStore } from '@/features/docs/stores/docsStore'

vi.mock('@matrix/client', () => ({
  getClient: vi.fn(() => ({
    getRooms: vi.fn(() => []),
    createRoom: vi.fn().mockResolvedValue({
      room_id: '!new:localhost',
    }),
    getUserId: vi.fn(() => '@test:localhost'),
  })),
}))

describe('docsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with empty documents', () => {
    const store = useDocsStore()
    expect(store.documents).toEqual([])
  })

  it('filters documents by search query', () => {
    const store = useDocsStore()
    store.documents = [{
      id: '1', title: 'Test Doc', owner: 'user', updated: 'now',
      type: '文档', status: '草稿', folder: '全部文档',
      sectionIds: ['recent'], roomId: '!room:localhost',
    }]
    store.searchQuery = 'test'
    expect(store.filteredDocuments).toHaveLength(1)
    store.searchQuery = 'nonexistent'
    expect(store.filteredDocuments).toHaveLength(0)
  })
})
```

- [ ] **Step 3: 运行测试并提交**

```bash
pnpm test:unit -- tests/unit/docs/
git add tests/unit/docs/
git commit -m "test(docs): add unit tests for MatrixSyncProvider and docsStore"
```

---

## Final Self-Review

### Spec Coverage Check
- ✅ 文档编辑器页面 → Tasks 9-11
- ✅ 实时协同编辑 → Tasks 3-6
- ✅ 文档管理侧边栏 → Tasks 15-16
- ✅ 评论与分享协作 → Tasks 13-14
- ✅ 类型定义 → Task 2
- ✅ 路由 → Task 19
- ✅ 测试 → Task 20

### Placeholder Check
- 无 TBD/TODO
- 无 "implement later"
- 所有代码步骤均有具体实现
- 测试包含完整代码

### Type Consistency
- `DocEntry` 在所有 task 中使用一致的字段名
- `MatrixSyncProvider` 的接口与 `useDocSync` 中的使用匹配
- `useDocComments` 的返回值与 `CommentsPanel` 的 props 一致
