import type { TimelineRelationSummaries } from '@matrix/index'
import type { MatrixEvent } from 'matrix-js-sdk'
import type { DesktopEffect } from '@/shared/lib/effect'
import {
  getTimeline,
  getTimelineRelationSummaries,
  matrixEvents,
  paginateBack,
  sendReadReceipt,
  syncState,
} from '@matrix/index'
import { useSelector } from '@tanstack/vue-store'
import { Effect } from 'effect'
import { fromPromise, fromSync, runDesktopEffect } from '@/shared/lib/effect'
import { chatStore } from '../stores/chatStore'

const TIMELINE_REFRESH_SYNC_STATES = new Set(['CATCHUP', 'PREPARED', 'SYNCING'])
const HISTORY_PAGE_SIZE = 30
const INITIAL_HISTORY_BACKFILL_MAX_ATTEMPTS = 5

export function useMessages() {
  const currentRoomId = useSelector(chatStore, (s) => s.currentRoomId)
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
  let activeBackfillKey: string | null = null

  function isActiveRoomRequest(roomId: string, version: number) {
    return chatStore.state.currentRoomId === roomId && roomSessionVersion === version
  }

  function replaceTimeline(roomId: string) {
    const timeline = getTimeline(roomId, displayLimit.value)
    messages.value = timeline
    relationSummaries.value = getTimelineRelationSummaries(roomId)
    timelineVersion.value++
    return timeline
  }

  function loadTimeline() {
    const roomId = chatStore.state.currentRoomId
    if (!roomId) return
    replaceTimeline(roomId)
  }

  function refreshTimelineAndBackfill() {
    const roomId = chatStore.state.currentRoomId
    if (!roomId) return

    const requestVersion = roomSessionVersion
    const previousLength = messages.value.length
    const timeline = replaceTimeline(roomId)
    if (!hasMore.value && previousLength === 0 && timeline.length > 0 && displayLimit.value !== Infinity) {
      hasMore.value = true
    }
    void backfillCurrentRoomHistory(roomId, requestVersion, { showLoading: timeline.length === 0 })
  }

  function isBackfillActiveFor(roomId: string, requestVersion: number) {
    return activeBackfillKey === `${roomId}:${requestVersion}`
  }

  function backfillCurrentRoomHistoryEffect(
    roomId: string,
    requestVersion: number,
    options: { showLoading: boolean },
  ): DesktopEffect<void> {
    const backfillKey = `${roomId}:${requestVersion}`
    let ownsBackfill = false

    return Effect.gen(function* () {
      if (!TIMELINE_REFRESH_SYNC_STATES.has(syncState.value)) return
      if (activeBackfillKey === backfillKey) return

      yield* fromSync(() => {
        activeBackfillKey = backfillKey
        ownsBackfill = true
        if (options.showLoading) isLoading.value = true
      })

      let attempts = 0
      let timeline = getTimeline(roomId, displayLimit.value)
      while (
        isActiveRoomRequest(roomId, requestVersion) &&
        hasMore.value &&
        timeline.length < displayLimit.value &&
        attempts < INITIAL_HISTORY_BACKFILL_MAX_ATTEMPTS
      ) {
        attempts++
        const loaded = yield* fromPromise(() => paginateBack(roomId, HISTORY_PAGE_SIZE))
        if (!isActiveRoomRequest(roomId, requestVersion)) return

        timeline = replaceTimeline(roomId)
        if (!loaded) {
          hasMore.value = false
          break
        }
      }
    }).pipe(
      Effect.catchAll((err) => fromSync(() => console.error('[useMessages] Failed to backfill room history:', err))),
      Effect.ensuring(
        Effect.sync(() => {
          if (ownsBackfill && activeBackfillKey === backfillKey) activeBackfillKey = null
          if (ownsBackfill && options.showLoading && isActiveRoomRequest(roomId, requestVersion))
            isLoading.value = false
        }),
      ),
    )
  }

  function backfillCurrentRoomHistory(
    roomId: string,
    requestVersion: number,
    options: { showLoading: boolean },
  ): Promise<void> {
    return runDesktopEffect(backfillCurrentRoomHistoryEffect(roomId, requestVersion, options))
  }

  function loadMoreEffect(): DesktopEffect<boolean> {
    const roomId = chatStore.state.currentRoomId
    const requestVersion = roomSessionVersion
    let ownsLoading = false

    return Effect.gen(function* () {
      if (!roomId || isLoading.value || isBackfillActiveFor(roomId, requestVersion) || !hasMore.value) return false
      yield* fromSync(() => {
        ownsLoading = true
        isLoading.value = true
      })

      const prevCount = messages.value.length
      // 持续分页直到拿到新的可见消息或历史耗尽
      let attempts = 0
      while (attempts < 5) {
        const loaded = yield* fromPromise(() => paginateBack(roomId, HISTORY_PAGE_SIZE))
        if (!isActiveRoomRequest(roomId, requestVersion)) return false
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
      return true
    }).pipe(
      Effect.catchAll((err) =>
        fromSync(() => {
          console.error('[useMessages] Failed to load more messages:', err)
          return false
        }),
      ),
      Effect.ensuring(
        Effect.sync(() => {
          if (ownsLoading && roomId && isActiveRoomRequest(roomId, requestVersion)) isLoading.value = false
        }),
      ),
    )
  }

  function loadMore(): Promise<boolean> {
    return runDesktopEffect(loadMoreEffect())
  }

  /** 对当前房间最新消息发送已读回执 */
  function markAsReadEffect(): DesktopEffect<void> {
    const roomId = chatStore.state.currentRoomId
    if (!roomId) return Effect.succeed(undefined)
    const list = messages.value
    if (list.length === 0) return Effect.succeed(undefined)
    const lastEvent = list.at(-1)
    if (!lastEvent) return Effect.succeed(undefined)
    const eventId = lastEvent.getId()
    if (!eventId) return Effect.succeed(undefined)

    return fromPromise(() => sendReadReceipt(roomId, eventId)).pipe(
      Effect.catchAll(() => Effect.succeed(undefined)),
      Effect.asVoid,
    )
  }

  function markAsRead() {
    void runDesktopEffect(markAsReadEffect())
  }

  const debouncedRefreshTimeline = useDebounceFn(() => refreshTimelineAndBackfill(), 80)

  function onTimelineUpdate(payload: { roomId: string }) {
    if (payload.roomId === chatStore.state.currentRoomId) debouncedRefreshTimeline()
  }

  /** 当前房间收到新消息时自动标记已读 */
  function onNewMessage(payload: { roomId: string }) {
    if (payload.roomId === chatStore.state.currentRoomId) markAsRead()
  }

  function onSyncState(payload: { state: string }) {
    if (!TIMELINE_REFRESH_SYNC_STATES.has(payload.state)) return
    refreshTimelineAndBackfill()
  }

  function handleCurrentRoomChangeEffect(): DesktopEffect<void> {
    return Effect.gen(function* () {
      roomSessionVersion++
      const requestVersion = roomSessionVersion
      hasMore.value = true
      displayLimit.value = 50

      // 原子性切换：先同步获取新房间消息，直接替换旧消息
      // 避免 messages=[] 清空导致的 DOM 闪白
      const roomId = chatStore.state.currentRoomId
      if (roomId) {
        // 直接替换，不经过空数组中间态
        const timeline = replaceTimeline(roomId)
        const shouldShowLoading = timeline.length === 0
        const backfillPromise = runDesktopEffect(
          backfillCurrentRoomHistoryEffect(roomId, requestVersion, { showLoading: shouldShowLoading }),
        )
        if (shouldShowLoading) yield* fromPromise(() => backfillPromise)
        else void backfillPromise
        if (!isActiveRoomRequest(roomId, requestVersion)) return
        yield* markAsReadEffect()
      } else {
        messages.value = []
        relationSummaries.value = {
          reactionsByEventId: new Map(),
          threadReplyCountsByEventId: new Map(),
        }
      }
    })
  }

  watch(
    currentRoomId,
    () => {
      void runDesktopEffect(handleCurrentRoomChangeEffect())
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

  return {
    messages,
    isLoading,
    hasMore,
    loadMoreEffect,
    markAsReadEffect,
    loadMore,
    refresh: loadTimeline,
    relationSummaries,
    timelineVersion,
  }
}
