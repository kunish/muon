<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import MediaViewer from '@/features/chat/components/MediaViewer.vue'
import { useMediaViewer } from '@/features/chat/composables/useMediaViewer'
import { useDocComments } from '../../composables/useDocComments'
import { useDocCursor } from '../../composables/useDocCursor'
import { useDocEditor } from '../../composables/useDocEditor'
import { useDocSync } from '../../composables/useDocSync'
import { resolveCurrentDocUser } from '../../lib/currentDocUser'
import { useDocsStore } from '../../stores/docsStore'
import CollaboratorAvatars from '../collaboration/CollaboratorAvatars.vue'
import CommentsPanel from '../collaboration/CommentsPanel.vue'
import ShareDialog from '../collaboration/ShareDialog.vue'
import DocEditorToolbar from './DocEditorToolbar.vue'
import DocTitleInput from './DocTitleInput.vue'

const props = defineProps<{
  docId: string
  userName?: string
}>()

const currentUser = resolveCurrentDocUser(props.userName)
const currentUserId = currentUser.id
const userName = computed(() => props.userName ?? currentUser.name)
const color = currentUser.color
const docsStore = useDocsStore()
const router = useRouter()
const currentDoc = computed(() => docsStore.documents.find(doc => doc.id === props.docId))
const initialTitle = computed(() => currentDoc.value?.title ?? '')

const { ydoc, provider, connected, error, connect, disconnect } = useDocSync(props.docId)

const elementRef = ref<HTMLElement>()
const { editor } = useDocEditor(
  () => ydoc.value,
  elementRef,
  { id: currentUserId, name: userName.value, color },
)

const { others, updateLocalCursor } = useDocCursor(
  () => provider.value,
  currentUserId,
  userName.value,
)

const { comments, draftText, addComment, resolveComment } = useDocComments(
  () => ydoc.value,
  currentUserId,
)

const showComments = ref(false)
const showShareDialog = ref(false)
const imageInputRef = ref<HTMLInputElement>()
const imageInsertError = shallowRef('')
const { openImage } = useMediaViewer()

watch(
  editor,
  (currentEditor, _previousEditor, onCleanup) => {
    if (!currentEditor)
      return

    const publishCursor = (): void => {
      const { from, to } = currentEditor.state.selection
      updateLocalCursor(from, to)
    }

    if (typeof currentEditor.on !== 'function' || typeof currentEditor.off !== 'function') {
      publishCursor()
      return
    }

    currentEditor.on('selectionUpdate', publishCursor)
    publishCursor()

    onCleanup(() => {
      currentEditor.off('selectionUpdate', publishCursor)
    })
  },
  { immediate: true },
)

function handleTitleChange(title: string): void {
  void docsStore.updateDocumentTitle(props.docId, title)
}

function backToDocsList(): void {
  void router.push('/docs')
}

function getCurrentCommentSelection(): { from: number, to: number } | undefined {
  const selection = editor.value?.state.selection
  if (!selection || selection.empty)
    return undefined

  const from = Math.min(selection.from, selection.to)
  const to = Math.max(selection.from, selection.to)
  if (from === to)
    return undefined

  return { from, to }
}

function handleAddComment(text: string): void {
  addComment(text, getCurrentCommentSelection())
}

function focusEditorFromCanvas(event: MouseEvent): void {
  const target = event.target
  if (!(target instanceof HTMLElement))
    return
  if (target.closest('button, input, textarea, select, a, [contenteditable="true"]'))
    return

  editor.value?.chain().focus('end').run()
}

function openImagePicker(): void {
  imageInputRef.value?.click()
}

function openEditorImagePreview(event: MouseEvent): void {
  const target = event.target
  if (!(target instanceof HTMLElement))
    return

  const image = target.closest('img') as HTMLImageElement | null
  if (!image || !elementRef.value?.contains(image))
    return

  const src = image.currentSrc || image.src
  if (!src)
    return

  event.preventDefault()
  event.stopPropagation()
  openImage(src)
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('Failed to read image file'))
    }
    reader.readAsDataURL(file)
  })
}

async function handleImageInputChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  imageInsertError.value = ''

  if (!file)
    return

  if (!file.type.startsWith('image/')) {
    imageInsertError.value = '请选择图片文件'
    return
  }

  try {
    const src = await readFileAsDataUrl(file)
    editor.value?.chain().focus().setImage({ src, alt: file.name }).run()
  }
  catch {
    imageInsertError.value = '图片插入失败'
  }
}

connect()

onUnmounted(() => {
  disconnect()
})
</script>

<template>
  <div class="flex h-full min-w-0 flex-1 flex-col bg-background">
    <!-- Top bar -->
    <div class="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
      <div class="flex items-center gap-3">
        <button
          data-testid="doc-editor-back"
          class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="返回文档列表"
          aria-label="返回文档列表"
          @click="backToDocsList"
        >
          <ArrowLeft :size="18" />
        </button>
        <span
          data-testid="doc-sync-status"
          class="inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs font-medium"
          :class="connected ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'"
        >
          <span
            class="size-1.5 rounded-full"
            :class="connected ? 'bg-green-500 dark:bg-green-400' : 'bg-yellow-500 dark:bg-yellow-400'"
          />
          {{ connected ? '已连接' : '连接中' }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <CollaboratorAvatars :cursors="others" />
        <button
          data-testid="doc-editor-comments"
          class="inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          :class="{ 'bg-accent text-foreground': showComments }"
          @click="showComments = !showComments"
        >
          评论
          <span
            v-if="comments.length > 0"
            class="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground"
          >
            {{ comments.length }}
          </span>
        </button>
        <button
          data-testid="doc-editor-share"
          class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          @click="showShareDialog = true"
        >
          分享
        </button>
      </div>
    </div>

    <!-- Toolbar -->
    <DocEditorToolbar :editor="editor" @insert-image="openImagePicker" />

    <!-- Editor area -->
    <div class="flex min-h-0 flex-1">
      <div
        class="doc-editor-scroll min-w-0 flex-1 overflow-y-auto"
        data-testid="doc-editor-scroll"
        @mousedown="focusEditorFromCanvas"
      >
        <main class="mx-auto flex min-h-full w-full max-w-[880px] flex-col px-10 py-9">
          <DocTitleInput
            :ydoc="ydoc"
            :initial-title="initialTitle"
            @update-title="handleTitleChange"
          />
          <div
            ref="elementRef"
            class="doc-editor-body min-h-[calc(100vh-260px)]"
            data-testid="doc-editor-body"
            @click="openEditorImagePreview"
          />
          <p v-if="imageInsertError" class="mt-3 text-xs text-destructive">
            {{ imageInsertError }}
          </p>
        </main>
      </div>

      <!-- Comments panel -->
      <CommentsPanel
        v-if="showComments"
        :comments="comments"
        :draft-text="draftText"
        @add-comment="handleAddComment"
        @resolve="resolveComment"
        @close="showComments = false"
      />
    </div>

    <p v-if="error" class="px-4 py-2 text-xs text-destructive">
      {{ error }}
    </p>

    <input
      ref="imageInputRef"
      class="hidden"
      type="file"
      accept="image/*"
      data-testid="doc-image-input"
      @change="handleImageInputChange"
    >

    <ShareDialog
      v-if="showShareDialog"
      :doc-id="props.docId"
      :doc-title="currentDoc?.title ?? initialTitle"
      @close="showShareDialog = false"
    />
    <MediaViewer />
  </div>
</template>

<style scoped>
.doc-editor-scroll {
  scrollbar-gutter: stable;
}

.doc-editor-body {
  --doc-code-bg: color-mix(in srgb, var(--color-muted) 58%, var(--color-background));
  --doc-code-border: color-mix(in srgb, var(--color-border) 82%, transparent);
  --doc-code-header-bg: color-mix(in srgb, var(--color-muted) 74%, var(--color-background));
  --doc-code-text: #1f2937;
  --doc-code-muted: #64748b;
  --doc-code-keyword: #4f46e5;
  --doc-code-string: #15803d;
  --doc-code-title: #b45309;
  --doc-code-number: #c2410c;
  --doc-code-comment: #6b7280;
  --doc-code-attr: #7c3aed;
  --doc-code-type: #0369a1;
  --doc-code-deletion: #dc2626;
  color: var(--color-foreground);
  font-size: 15px;
  line-height: 1.75;
}

:global(.dark) .doc-editor-body {
  --doc-code-bg: color-mix(in srgb, #111827 88%, var(--color-background));
  --doc-code-border: color-mix(in srgb, var(--color-border) 72%, transparent);
  --doc-code-header-bg: color-mix(in srgb, #1f2937 72%, var(--color-background));
  --doc-code-text: #d8dee9;
  --doc-code-muted: #7f8c98;
  --doc-code-keyword: #82aaff;
  --doc-code-string: #c3e88d;
  --doc-code-title: #ffcb6b;
  --doc-code-number: #f78c6c;
  --doc-code-comment: #7f8c98;
  --doc-code-attr: #c792ea;
  --doc-code-type: #89ddff;
  --doc-code-deletion: #ff757f;
}

.doc-editor-body :deep(.ProseMirror) {
  min-height: calc(100vh - 260px);
  outline: none;
  caret-color: var(--color-primary);
  word-break: break-word;
}

.doc-editor-body :deep(.ProseMirror p) {
  margin: 0 0 0.85em;
}

.doc-editor-body :deep(.ProseMirror > :first-child) {
  margin-top: 0;
}

.doc-editor-body :deep(.ProseMirror h1) {
  margin: 0.72em 0 0.2em;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.25;
}

.doc-editor-body :deep(.ProseMirror h2) {
  margin: 0.64em 0 0.18em;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.3;
}

.doc-editor-body :deep(.ProseMirror h3) {
  margin: 0.56em 0 0.16em;
  font-size: 18px;
  font-weight: 650;
  line-height: 1.35;
}

.doc-editor-body :deep(.ProseMirror h1 + p),
.doc-editor-body :deep(.ProseMirror h2 + p),
.doc-editor-body :deep(.ProseMirror h3 + p) {
  margin-top: 0;
}

.doc-editor-body :deep(.ProseMirror h1 + ul),
.doc-editor-body :deep(.ProseMirror h1 + ol),
.doc-editor-body :deep(.ProseMirror h2 + ul),
.doc-editor-body :deep(.ProseMirror h2 + ol),
.doc-editor-body :deep(.ProseMirror h3 + ul),
.doc-editor-body :deep(.ProseMirror h3 + ol) {
  margin-top: 0.05em;
}

.doc-editor-body :deep(.ProseMirror ul + h1),
.doc-editor-body :deep(.ProseMirror ol + h1),
.doc-editor-body :deep(.ProseMirror ul + h2),
.doc-editor-body :deep(.ProseMirror ol + h2),
.doc-editor-body :deep(.ProseMirror ul + h3),
.doc-editor-body :deep(.ProseMirror ol + h3) {
  margin-top: 0.56em;
}

.doc-editor-body :deep(.ProseMirror ul),
.doc-editor-body :deep(.ProseMirror ol) {
  margin: 0.2em 0 0.45em;
  padding-left: 1.2em;
}

.doc-editor-body :deep(.ProseMirror ul) {
  list-style: disc;
}

.doc-editor-body :deep(.ProseMirror ol) {
  list-style: decimal;
}

.doc-editor-body :deep(.ProseMirror li) {
  margin: 0.08em 0;
  padding-left: 0.05em;
}

.doc-editor-body :deep(.ProseMirror li > p) {
  margin: 0;
}

.doc-editor-body :deep(.ProseMirror li > p + p) {
  margin-top: 0.35em;
}

.doc-editor-body :deep(.ProseMirror blockquote) {
  margin: 0.8em 0;
  border-left: 3px solid var(--color-border);
  padding-left: 1em;
  color: var(--color-muted-foreground);
}

.doc-editor-body :deep(.ProseMirror code) {
  border-radius: 4px;
  background: var(--color-muted);
  padding: 0.12em 0.35em;
  font-size: 0.88em;
}

.doc-editor-body :deep(.ProseMirror pre) {
  margin: 0;
  overflow-x: auto;
  padding: 14px 16px;
  background: var(--doc-code-bg);
  color: var(--doc-code-text);
}

.doc-editor-body :deep(.ProseMirror pre code) {
  display: block;
  min-height: 1.7em;
  background: var(--doc-code-bg);
  padding: 0;
  color: inherit;
  font-size: 13px;
  line-height: 1.7;
  tab-size: 2;
  white-space: pre;
}

.doc-editor-body :deep(.ProseMirror pre code.hljs) {
  display: block;
}

.doc-editor-body :deep(.ProseMirror > pre) {
  margin: 0.9em 0;
  border: 1px solid var(--doc-code-border);
  border-radius: 8px;
}

.doc-editor-body :deep(.doc-code-block-view) {
  margin: 0.9em 0;
  overflow: hidden;
  border: 1px solid var(--doc-code-border);
  border-radius: 8px;
  background: var(--doc-code-bg);
  color: var(--doc-code-text);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 4%);
}

.doc-editor-body :deep(.doc-code-block-view pre) {
  background: var(--doc-code-bg);
}

.doc-editor-body :deep(.doc-code-block-view code) {
  background: var(--doc-code-bg);
}

.doc-editor-body :deep(.doc-code-block-toolbar) {
  display: flex;
  min-height: 34px;
  align-items: center;
  justify-content: flex-end;
  border-bottom: 1px solid var(--doc-code-border);
  background: var(--doc-code-header-bg);
  padding: 4px 8px;
}

.doc-editor-body :deep(.doc-code-language-control) {
  display: inline-flex;
  height: 26px;
  align-items: center;
  gap: 6px;
  border-radius: 6px;
  padding: 0 8px;
  color: var(--doc-code-muted);
}

.doc-editor-body :deep(.doc-code-language-control:focus-within),
.doc-editor-body :deep(.doc-code-language-control:hover) {
  background: color-mix(in srgb, var(--color-background) 70%, transparent);
  color: var(--color-foreground);
}

.doc-editor-body :deep(.doc-code-language-icon) {
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1;
}

.doc-editor-body :deep(.doc-code-language-select) {
  height: 24px;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 12px;
  font-weight: 600;
  outline: none;
}

.doc-editor-body :deep(.hljs-keyword),
.doc-editor-body :deep(.hljs-selector-tag),
.doc-editor-body :deep(.hljs-built_in) {
  color: var(--doc-code-keyword);
}

.doc-editor-body :deep(.hljs-string),
.doc-editor-body :deep(.hljs-regexp),
.doc-editor-body :deep(.hljs-addition) {
  color: var(--doc-code-string);
}

.doc-editor-body :deep(.hljs-title),
.doc-editor-body :deep(.hljs-function),
.doc-editor-body :deep(.hljs-section) {
  color: var(--doc-code-title);
}

.doc-editor-body :deep(.hljs-number),
.doc-editor-body :deep(.hljs-literal),
.doc-editor-body :deep(.hljs-symbol) {
  color: var(--doc-code-number);
}

.doc-editor-body :deep(.hljs-comment),
.doc-editor-body :deep(.hljs-quote) {
  color: var(--doc-code-comment);
  font-style: italic;
}

.doc-editor-body :deep(.hljs-attr),
.doc-editor-body :deep(.hljs-variable),
.doc-editor-body :deep(.hljs-template-variable) {
  color: var(--doc-code-attr);
}

.doc-editor-body :deep(.hljs-type),
.doc-editor-body :deep(.hljs-class),
.doc-editor-body :deep(.hljs-tag),
.doc-editor-body :deep(.hljs-name) {
  color: var(--doc-code-type);
}

.doc-editor-body :deep(.hljs-deletion) {
  color: var(--doc-code-deletion);
}

.doc-editor-body :deep(.ProseMirror table) {
  margin: 1em 0;
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.doc-editor-body :deep(.ProseMirror th),
.doc-editor-body :deep(.ProseMirror td) {
  min-width: 80px;
  border: 1px solid var(--color-border);
  padding: 8px 10px;
  vertical-align: top;
}

.doc-editor-body :deep(.ProseMirror th) {
  background: var(--color-muted);
  font-weight: 650;
  text-align: left;
}

.doc-editor-body :deep(.ProseMirror img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0.9em 0;
  border-radius: 6px;
  cursor: zoom-in;
}

.doc-editor-body :deep(.ProseMirror .is-empty::before) {
  float: left;
  height: 0;
  color: var(--color-muted-foreground);
  content: attr(data-placeholder);
  pointer-events: none;
}
</style>
