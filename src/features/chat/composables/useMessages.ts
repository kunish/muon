import type { MatrixEvent } from 'matrix-js-sdk'
import { getTimeline, matrixEvents, paginateBack } from '@matrix/index'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useChatStore } from '../stores/chatStore'

export function useMessages() {
  const store = useChatStore()
  const messages = ref<MatrixEvent[]>([])
  const isLoading = ref(false)
  const hasMore = ref(true)

  function loadTimeline() {
    const roomId = store.currentRoomId
    if (!roomId)
      return
    messages.value = getTimeline(roomId)
  }

  async function loadMore() {
    const roomId = store.currentRoomId
    if (!roomId || isLoading.value || !hasMore.value)
      return
    isLoading.value = true
    try {
      const loaded = await paginateBack(roomId, 30)
      if (!loaded)
        hasMore.value = false
      messages.value = getTimeline(roomId)
    }
    finally {
      isLoading.value = false
    }
  }

  function onNewMessage() {
    loadTimeline()
  }

  watch(() => store.currentRoomId, () => {
    messages.value = []
    hasMore.value = true
    loadTimeline()
  })

  onMounted(() => {
    matrixEvents.on('room.message', onNewMessage)
    matrixEvents.on('room.redaction', onNewMessage)
  })

  onUnmounted(() => {
    matrixEvents.off('room.message', onNewMessage)
    matrixEvents.off('room.redaction', onNewMessage)
  })

  return { messages, isLoading, hasMore, loadMore, refresh: loadTimeline }
}
