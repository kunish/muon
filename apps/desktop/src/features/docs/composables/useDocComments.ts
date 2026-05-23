import type { Doc } from 'yjs'
import type { DocComment } from '../types/doc'
import { nanoid } from 'nanoid'
import { computed, onUnmounted, shallowRef } from 'vue'

export function useDocComments(ydoc: () => Doc, currentUserId: string) {
  const draftText = shallowRef('')
  const comments = shallowRef<DocComment[]>([])

  const ycomments = ydoc().getArray<DocComment>('comments')

  function syncFromYjs(): void {
    comments.value = ycomments.toArray()
  }

  ycomments.observe(syncFromYjs)

  syncFromYjs()

  onUnmounted(() => {
    ycomments.unobserve(syncFromYjs)
  })

  const resolvedCount = computed(() => comments.value.filter((c) => c.resolved).length)
  const unresolvedCount = computed(() => comments.value.filter((c) => !c.resolved).length)

  function addComment(text: string, selection?: { from: number; to: number }): void {
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
    const idx = ycomments.toArray().findIndex((c) => c.id === commentId)
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
