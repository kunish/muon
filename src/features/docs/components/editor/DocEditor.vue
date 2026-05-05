<script setup lang="ts">
import { ref } from 'vue'
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

const currentUserId = 'current-user' // TODO: get from auth store when available
const userName = props.userName ?? '我'
const color = userColor(currentUserId)

const { ydoc, connected, error, connect, disconnect } = useDocSync(props.docId)

const elementRef = ref<HTMLElement>()
const { editor } = useDocEditor(
  () => ydoc.value,
  elementRef,
  { id: currentUserId, name: userName, color },
)

const { others } = useDocCursor(
  () => null,
  currentUserId,
  userName,
)

const { comments, draftText, addComment, resolveComment } = useDocComments(
  () => ydoc.value,
  currentUserId,
)

const showComments = ref(false)

connect()
</script>

<template>
  <div class="flex h-full min-w-0 flex-1 flex-col bg-background">
    <!-- Top bar -->
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
        <DocTitleInput :ydoc="ydoc" />
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

    <p v-if="error" class="px-4 py-2 text-xs text-red-500">{{ error }}</p>
  </div>
</template>
