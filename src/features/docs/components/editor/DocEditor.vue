<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import { computed, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDocComments } from '../../composables/useDocComments'
import { useDocCursor } from '../../composables/useDocCursor'
import { useDocEditor } from '../../composables/useDocEditor'
import { useDocSync } from '../../composables/useDocSync'
import { resolveCurrentDocUser } from '../../lib/currentDocUser'
import { useDocsStore } from '../../stores/docsStore'
import CollaboratorAvatars from '../collaboration/CollaboratorAvatars.vue'
import CommentsPanel from '../collaboration/CommentsPanel.vue'
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

const { others } = useDocCursor(
  () => provider.value,
  currentUserId,
  userName.value,
)

const { comments, draftText, addComment, resolveComment } = useDocComments(
  () => ydoc.value,
  currentUserId,
)

const showComments = ref(false)

function handleTitleChange(title: string): void {
  void docsStore.updateDocumentTitle(props.docId, title)
}

function backToDocsList(): void {
  void router.push('/docs')
}

connect()

onUnmounted(() => {
  disconnect()
})
</script>

<template>
  <div class="flex h-full min-w-0 flex-1 flex-col bg-background">
    <!-- Top bar -->
    <div class="flex items-center justify-between border-b border-border px-4 py-2">
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
          class="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          分享
        </button>
      </div>
    </div>

    <!-- Toolbar -->
    <DocEditorToolbar :editor="editor" />

    <!-- Editor area -->
    <div class="flex min-h-0 flex-1">
      <div class="min-w-0 flex-1 overflow-y-auto">
        <DocTitleInput
          :ydoc="ydoc"
          :initial-title="initialTitle"
          @update-title="handleTitleChange"
        />
        <div ref="elementRef" class="prose prose-sm max-w-none px-4 py-2" />
      </div>

      <!-- Comments panel -->
      <CommentsPanel
        v-if="showComments"
        :comments="comments"
        :draft-text="draftText"
        @add-comment="addComment"
        @resolve="resolveComment"
        @close="showComments = false"
      />
    </div>

    <p v-if="error" class="px-4 py-2 text-xs text-red-500">
      {{ error }}
    </p>
  </div>
</template>
