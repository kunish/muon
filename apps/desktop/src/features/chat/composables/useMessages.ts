import type { TimelineRelationSummaries } from '@matrix/index'
import type { MatrixEvent } from 'matrix-js-sdk'
import { getTimeline, getTimelineRelationSummaries, matrixEvents, paginateBack, sendReadReceipt } from '@matrix/index'
import { useDebounceFn } from '@vueuse/core'
import { onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useChatStore } from '../stores/chatStore'

const TIMELINE_REFRESH_SYNC_STATES = new Set(['CATCHUP', 'PREPARED', 'SYNCING'])

export function useMessages() {
  const store = useChatStore()
  const messages = shallowRef<MatrixEvent[]>([])
  const isLoading = ref(false)
  const hasMore = ref(true)
  const displayLimit = ref(50)
  const timelineVersion = ref(0)
  const relationSummaries = shallowRef<TimelineRelationSummaries>({
    reactionsByEventId: new Map(),
    threadReplyCountsByEventId: new Map(),
  })
  let roomSessionVersion = 0

  function isActiveRoomRequest(roomId: string, version: number) {
    return store.currentRoomId === roomId && roomSessionVersion === version
  }

  function loadTimeline() {
    const roomId = store.currentRoomId
    if (!roomId) return
    messages.value = getTimeline(roomId, displayLimit.value)
    relationSummaries.value = getTimelineRelationSummaries(roomId)
    timelineVersion.value++
  }

  async function loadMore() {
    const roomId = store.currentRoomId
    if (!roomId || isLoading.value || !hasMore.value) return
    const requestVersion = roomSessionVersion
    isLoading.value = true
    try {
      const prevCount = messages.value.length
      // 持续分页直到拿到新的可见消息或历史耗尽
      let attempts = 0
      while (attempts < 5) {
        const loaded = await paginateBack(roomId, 30)
        if (!isActiveRoomRequest(roomId, requestVersion)) return
        if (!loaded) {
          hasMore.value = false
          // 服务端无更多历史，但本地 timeline 可能有超过 displayLimit 的事件
          // （例如初始同步一次性加载了全部历史）。移除 limit 限制以显示全部本地事件。
          displayLimit.value = Infinity
          messages.value = getTimeline(roomId, displayLimit.value)
          relationSummaries.value = getTimelineRelationSummaries(roomId)
          break
        }
        displayLimit.value += 30
        messages.value = getTimeline(roomId, displayLimit.value)
        relationSummaries.value = getTimelineRelationSummaries(roomId)
        if (messages.value.length > prevCount) break
        attempts++
      }
    } catch (err) {
      console.error('[useMessages] Failed to load more messages:', err)
    } finally {
      if (isActiveRoomRequest(roomId, requestVersion)) isLoading.value = false
    }
  }

  /** 对当前房间最新消息发送已读回执 */
  function markAsRead() {
    const roomId = store.currentRoomId
    if (!roomId) return
    const list = messages.value
    if (list.length === 0) return
    const lastEvent = list.at(-1)
    if (!lastEvent) return
    const eventId = lastEvent.getId()
    if (eventId) {
      sendReadReceipt(roomId, eventId).catch(() => {
        /* read receipt failures are non-critical, user experience unaffected */
      })
    }
  }

  const debouncedLoadTimeline = useDebounceFn(() => loadTimeline(), 80)

  function onTimelineUpdate(payload: { roomId: string }) {
    if (payload.roomId === store.currentRoomId) debouncedLoadTimeline()
  }

  /** 当前房间收到新消息时自动标记已读 */
  function onNewMessage(payload: { roomId: string }) {
    if (payload.roomId === store.currentRoomId) markAsRead()
  }

  function onSyncState(payload: { state: string }) {
    if (TIMELINE_REFRESH_SYNC_STATES.has(payload.state)) loadTimeline()
  }

  watch(
    () => store.currentRoomId,
    async () => {
      roomSessionVersion++
      const requestVersion = roomSessionVersion
      hasMore.value = true
      displayLimit.value = 50

      // 原子性切换：先同步获取新房间消息，直接替换旧消息
      // 避免 messages=[] 清空导致的 DOM 闪白
      const roomId = store.currentRoomId
      if (roomId) {
        const timeline = getTimeline(roomId, displayLimit.value)
        relationSummaries.value = getTimelineRelationSummaries(roomId)
        // 直接替换，不经过空数组中间态
        messages.value = timeline
        timelineVersion.value++
        // 如果本地无缓存才异步加载（此时 MessageList 会显示 loading）
        if (timeline.length === 0) {
          isLoading.value = true
          try {
            await paginateBack(roomId, 30)
            if (!isActiveRoomRequest(roomId, requestVersion)) return
            messages.value = getTimeline(roomId, displayLimit.value)
            relationSummaries.value = getTimelineRelationSummaries(roomId)
          } finally {
            if (isActiveRoomRequest(roomId, requestVersion)) {
              isLoading.value = false
            }
          }
        }
        if (!isActiveRoomRequest(roomId, requestVersion)) return
        markAsRead()
      } else {
        messages.value = []
        relationSummaries.value = {
          reactionsByEventId: new Map(),
          threadReplyCountsByEventId: new Map(),
        }
      }
    },
    { immediate: true },
  )

  onMounted(() => {
    matrixEvents.on('room.timeline', onTimelineUpdate)
    matrixEvents.on('room.redaction', onTimelineUpdate)
    matrixEvents.on('room.localEchoUpdated', onTimelineUpdate)
    matrixEvents.on('room.message', onNewMessage)
    matrixEvents.on('sync.state', onSyncState)
  })

  onUnmounted(() => {
    matrixEvents.off('room.timeline', onTimelineUpdate)
    matrixEvents.off('room.redaction', onTimelineUpdate)
    matrixEvents.off('room.localEchoUpdated', onTimelineUpdate)
    matrixEvents.off('room.message', onNewMessage)
    matrixEvents.off('sync.state', onSyncState)
  })

  return { messages, isLoading, hasMore, loadMore, refresh: loadTimeline, relationSummaries, timelineVersion }
}
