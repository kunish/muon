import type { MatrixEvent } from 'matrix-js-sdk'
import { getTimeline, matrixEvents, paginateBack, sendReadReceipt } from '@matrix/index'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useChatStore } from '../stores/chatStore'

export function useMessages() {
  const store = useChatStore()
  const messages = ref<MatrixEvent[]>([])
  const isLoading = ref(false)
  const hasMore = ref(true)
  const displayLimit = ref(50)
  const refreshKey = ref(0)

  function loadTimeline() {
    const roomId = store.currentRoomId
    if (!roomId)
      return
    messages.value = getTimeline(roomId, displayLimit.value)
    refreshKey.value++
  }

  async function loadMore() {
    const roomId = store.currentRoomId
    if (!roomId || isLoading.value || !hasMore.value)
      return
    isLoading.value = true
    try {
      const prevCount = messages.value.length
      // 持续分页直到拿到新的可见消息或历史耗尽
      let attempts = 0
      while (attempts < 5) {
        const loaded = await paginateBack(roomId, 30)
        if (!loaded) {
          hasMore.value = false
          // 服务端无更多历史，但本地 timeline 可能有超过 displayLimit 的事件
          // （例如初始同步一次性加载了全部历史）。移除 limit 限制以显示全部本地事件。
          displayLimit.value = Infinity
          messages.value = getTimeline(roomId, displayLimit.value)
          break
        }
        displayLimit.value += 30
        messages.value = getTimeline(roomId, displayLimit.value)
        if (messages.value.length > prevCount)
          break
        attempts++
      }
    }
    catch (err) {
      console.error('[useMessages] Failed to load more messages:', err)
    }
    finally {
      isLoading.value = false
    }
  }

  /** 对当前房间最新消息发送已读回执 */
  function markAsRead() {
    const roomId = store.currentRoomId
    if (!roomId)
      return
    const list = messages.value
    if (list.length === 0)
      return
    const lastEvent = list.at(-1)
    if (!lastEvent)
      return
    const eventId = lastEvent.getId()
    if (eventId) {
      sendReadReceipt(roomId, eventId).catch(() => { /* read receipt failures are non-critical, user experience unaffected */ })
    }
  }

  function onTimelineUpdate(payload: { roomId: string }) {
    if (payload.roomId === store.currentRoomId)
      loadTimeline()
  }

  /** 当前房间收到新消息时自动标记已读 */
  function onNewMessage(payload: { roomId: string }) {
    if (payload.roomId === store.currentRoomId)
      markAsRead()
  }

  watch(() => store.currentRoomId, async () => {
    hasMore.value = true
    displayLimit.value = 50

    // 原子性切换：先同步获取新房间消息，直接替换旧消息
    // 避免 messages=[] 清空导致的 DOM 闪白
    const roomId = store.currentRoomId
    if (roomId) {
      const timeline = getTimeline(roomId, displayLimit.value)
      // 直接替换，不经过空数组中间态
      messages.value = timeline
      refreshKey.value++
      // 如果本地无缓存才异步加载（此时 MessageList 会显示 loading）
      if (timeline.length === 0) {
        isLoading.value = true
        try {
          await paginateBack(roomId, 30)
          if (store.currentRoomId !== roomId)
            return
          messages.value = getTimeline(roomId, displayLimit.value)
        }
        finally {
          if (store.currentRoomId === roomId) {
            isLoading.value = false
          }
        }
      }
      if (store.currentRoomId !== roomId)
        return
      markAsRead()
    }
    else {
      messages.value = []
    }
  }, { immediate: true })

  onMounted(() => {
    matrixEvents.on('room.timeline', onTimelineUpdate)
    matrixEvents.on('room.redaction', onTimelineUpdate)
    matrixEvents.on('room.localEchoUpdated', onTimelineUpdate)
    matrixEvents.on('room.message', onNewMessage)
  })

  onUnmounted(() => {
    matrixEvents.off('room.timeline', onTimelineUpdate)
    matrixEvents.off('room.redaction', onTimelineUpdate)
    matrixEvents.off('room.localEchoUpdated', onTimelineUpdate)
    matrixEvents.off('room.message', onNewMessage)
  })

  return { messages, isLoading, hasMore, loadMore, refresh: loadTimeline }
}
