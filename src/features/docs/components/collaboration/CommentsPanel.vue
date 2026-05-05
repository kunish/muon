<script setup lang="ts">
import { MessageSquare, X, CheckCircle2 } from 'lucide-vue-next'
import type { DocComment } from '../../types/doc'
import { shallowRef } from 'vue'

defineProps<{
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
