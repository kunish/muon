<script setup lang="ts">
import type { MatrixEvent } from 'matrix-js-sdk'
import { getReadMarkerEventId } from '@matrix/index'
import { ChevronDown } from 'lucide-vue-next'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useMessages } from '../composables/useMessages'
import { useChatStore } from '../stores/chatStore'
import ChannelWelcome from './ChannelWelcome.vue'
import MessageGroup from './MessageGroup.vue'
import UserInfoPanel from './UserInfoPanel.vue'

// ── Telegram 风格锚点式滚动位置管理 ───────────────────────────
//
//  来自 tdesktop history_view_list_widget.cpp 的核心设计：
//
//  滚动位置 = 锚点消息 ID + 像素偏移（而非绝对 scrollTop）
//  null 锚点 = "粘底"（类似 _visibleTopItem = nullptr）
//  pendingRestore 期间挂起所有滚动处理（类似 _scrollTopState.item 非空时
//    阻止 checkMoveToOtherViewer）
//
// ──────────────────────────────────────────────────────────────

const { messages, isLoading, hasMore, loadMore } = useMessages()
const store = useChatStore()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const containerRef = ref<HTMLElement>()
const sentinelRef = ref<HTMLElement>()
const isAtBottom = ref(true)
const showNewMsg = ref(false)
const isPaginating = ref(false)

// 房间切换时隐藏消息列表内容，防止滚动恢复前的视觉跳动
const isRestoring = ref(false)

// 头像点击弹窗状态
const infoPanelUserId = ref<string | null>(null)
const infoPanelPos = ref({ x: 0, y: 0 })

function onAvatarClick(userId: string, event: MouseEvent) {
  const rect = (event.target as HTMLElement).getBoundingClientRect()
  infoPanelPos.value = { x: rect.right, y: rect.top }
  infoPanelUserId.value = userId
}

function closeInfoPanel() {
  infoPanelUserId.value = null
}

const visibleMessages = computed(() =>
  messages.value.filter(ev => !store.isHidden(ev.getId() || '')) as MatrixEvent[],
)

const unreadEventId = computed(() => {
  const roomId = store.currentRoomId
  if (!roomId)
    return null
  const markerEventId = getReadMarkerEventId(roomId)
  if (!markerEventId)
    return null
  const markerIdx = visibleMessages.value.findIndex(
    e => e.getId() === markerEventId,
  )
  if (markerIdx < 0 || markerIdx >= visibleMessages.value.length - 1)
    return null
  // 未读分割线插在 marker 之后的第一条消息前
  return visibleMessages.value[markerIdx + 1]?.getId() ?? null
})

let observer: IntersectionObserver | null = null
const pendingFocusEventId = ref<string | null>(null)

// ── 锚点数据结构 ─────────────────────────────────────────────

interface ScrollAnchor {
  eventId: string
  offset: number
}

// 实时锚点（每次用户滚动时更新）
let liveAnchorEventId: string | null = null
let liveAnchorOffset = 0

// 每个房间的保存状态（类似 ListMemento）
// undefined = 首次进入，null = 粘底，ScrollAnchor = 中间位置
const scrollStateMap = new Map<string, ScrollAnchor | null>()

// 切换房间后等消息到达再恢复
// 此标志为 true 期间，onScroll / ResizeObserver 全部挂起
// （类似 Telegram 的 if (_scrollTopState.item) return 守卫）
let pendingRestore = false
let pendingRestoreRoomId: string | null = null

// ── 用户输入检测 ──────────────────────────────────────────────
//
//  核心思路：不通过 scroll 事件判断"用户是否离开底部"，
//  而是通过 wheel/touchstart/keydown 直接检测用户输入。
//  只有用户主动操作时才允许 isAtBottom 变为 false。
//  这样 LinkPreview 等异步内容加载引起的被动 scroll
//  永远不会误判为"用户手动离开底部"。
//
let userInteracting = false
let userInteractingTimer = 0

function onUserScrollIntent() {
  userInteracting = true
  // 150ms 无输入后重置——覆盖惯性滚动拖尾
  clearTimeout(userInteractingTimer)
  userInteractingTimer = window.setTimeout(() => {
    userInteracting = false
  }, 150)
}

// ── 锚点计算 ─────────────────────────────────────────────────

function findAnchorElement(
  el: HTMLElement,
  scrollTop: number,
): { eventId: string, offset: number } | null {
  const items = el.querySelectorAll<HTMLElement>('[data-event-id]')
  for (const item of items) {
    const top = item.offsetTop
    if (top + item.offsetHeight > scrollTop) {
      const eid = item.dataset.eventId
      if (eid)
        return { eventId: eid, offset: scrollTop - top }
    }
  }
  return null
}

function scrollToPosition(eventId: string, offset: number) {
  const el = containerRef.value
  if (!el)
    return false

  const target = el.querySelector<HTMLElement>(
    `[data-event-id="${CSS.escape(eventId)}"]`,
  )
  if (!target)
    return false

  el.scrollTop = target.offsetTop + offset
  liveAnchorEventId = eventId
  liveAnchorOffset = offset
  isAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 50
  if (isAtBottom.value)
    showNewMsg.value = false
  return true
}

function scrollToBottom() {
  const el = containerRef.value
  if (!el)
    return
  el.scrollTop = el.scrollHeight
  isAtBottom.value = true
  liveAnchorEventId = null
  liveAnchorOffset = 0
  showNewMsg.value = false
}

async function clearFocusQuery() {
  const nextQuery = { ...route.query }
  delete nextQuery.focusEventId
  await router.replace({ query: nextQuery })
}

async function tryFocusEventFromQuery() {
  const focusEventId = pendingFocusEventId.value
  if (!focusEventId)
    return

  await nextTick()
  const focused = scrollToPosition(focusEventId, -48)
  if (focused) {
    pendingFocusEventId.value = null
    await clearFocusQuery()
    return
  }

  if (hasMore.value && !isPaginating.value && !isLoading.value) {
    await triggerPagination()
  }
}

function onScroll() {
  if (pendingRestore)
    return

  const el = containerRef.value
  if (!el)
    return

  const atBot = el.scrollHeight - el.scrollTop - el.clientHeight < 50

  if (atBot) {
    liveAnchorEventId = null
    liveAnchorOffset = 0
    isAtBottom.value = true
    showNewMsg.value = false
    return
  }

  if (userInteracting) {
    isAtBottom.value = false
    const anchor = findAnchorElement(el, el.scrollTop)
    if (anchor) {
      liveAnchorEventId = anchor.eventId
      liveAnchorOffset = anchor.offset
    }
  }

  // 兜底：滚到顶部时主动触发分页，避免 IntersectionObserver 偶发不触发
  if (el.scrollTop <= 24 && !isPaginating.value && hasMore.value) {
    void triggerPagination()
  }
}

// ── 分页 ─────────────────────────────────────────────────────

async function triggerPagination() {
  if (isPaginating.value || !hasMore.value || isLoading.value)
    return
  const el = containerRef.value
  if (!el)
    return

  const wasAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50

  let savedId = liveAnchorEventId
  let savedOff = liveAnchorOffset

  // 某些输入方式（如拖拽滚动条）可能尚未写入 liveAnchor，
  // 分页前兜底取当前视口锚点，避免分页后误回到底部。
  if (!wasAtBottom && !savedId) {
    const fallbackAnchor = findAnchorElement(el, el.scrollTop)
    if (fallbackAnchor) {
      savedId = fallbackAnchor.eventId
      savedOff = fallbackAnchor.offset
    }
  }

  isPaginating.value = true
  await loadMore()
  await nextTick()

  if (savedId) {
    scrollToPosition(savedId, savedOff)
  }
  else if (wasAtBottom) {
    scrollToBottom()
  }
  isPaginating.value = false

  await nextTick()
  if (sentinelRef.value && hasMore.value) {
    const rect = sentinelRef.value.getBoundingClientRect()
    const containerRect = el.getBoundingClientRect()
    if (rect.bottom >= containerRect.top && rect.top <= containerRect.bottom) {
      triggerPagination()
    }
  }
}

// ── 房间切换 ─────────────────────────────────────────────────

watch(
  () => store.currentRoomId,
  (newId, oldId) => {
    // 保存旧房间锚点
    if (oldId) {
      scrollStateMap.set(
        oldId,
        liveAnchorEventId
          ? { eventId: liveAnchorEventId, offset: liveAnchorOffset }
          : null,
      )
    }

    // 挂起所有滚动处理，直到恢复完成
    pendingRestore = true
    pendingRestoreRoomId = newId || null
    liveAnchorEventId = null
    liveAnchorOffset = 0
    showNewMsg.value = false
    isPaginating.value = false

    // 隐藏消息列表内容，防止滚动恢复前的视觉跳动
    // visibility:hidden 保留布局占位，不会触发重排
    isRestoring.value = true
  },
)

// 消息到达后恢复滚动位置
// 必须 watch 数组引用而非 .length：原子性切换时新旧房间消息数可能相同，
// .length 不变则 watcher 不触发，pendingRestore 永远为 true
watch(visibleMessages, async (newArr, oldArr) => {
  const newLen = newArr.length
  const oldLen = oldArr?.length ?? 0
  if (pendingRestore && newLen > 0) {
    const roomId = pendingRestoreRoomId
    // 单次 nextTick 即可：Vue 的 DOM patch 在 nextTick 后已完成
    // 配合 visibility:hidden 遮盖，即使有微小误差也不可见
    await nextTick()

    if (roomId && scrollStateMap.has(roomId)) {
      const saved = scrollStateMap.get(roomId)
      if (saved) {
        const ok = scrollToPosition(saved.eventId, saved.offset)
        if (!ok)
          scrollToBottom()
      }
      else {
        // null = 之前粘底
        scrollToBottom()
      }
    }
    else {
      // 首次进入，滚到底部
      scrollToBottom()
    }

    // 解锁滚动处理 & 显示内容（滚动位置已就绪）
    pendingRestore = false
    pendingRestoreRoomId = null
    isRestoring.value = false
    return
  }

  // pendingRestore 期间忽略其他变化
  if (pendingRestore)
    return

  // 普通新消息到达
  if (newLen > (oldLen || 0) && !isPaginating.value) {
    if (isAtBottom.value) {
      await nextTick()
      scrollToBottom()
    }
    else {
      showNewMsg.value = true
    }
  }

  if (pendingFocusEventId.value) {
    await tryFocusEventFromQuery()
  }
})

watch(
  () => route.query.focusEventId,
  async (value) => {
    pendingFocusEventId.value = typeof value === 'string' ? value : null
    if (pendingFocusEventId.value) {
      await tryFocusEventFromQuery()
    }
  },
  { immediate: true },
)

// ── ResizeObserver ────────────────────────────────────────────

let resizeObs: ResizeObserver | null = null
let mutationObs: MutationObserver | null = null

// ResizeObserver 回调在布局完成后、绘制前触发，
// 直接同步修正 scrollTop 即可在同一帧内生效，
// 无需 requestAnimationFrame（RAF 会延迟到下一帧，导致 1 帧跳动）
function onChildResize() {
  if (pendingRestore || isPaginating.value)
    return

  const el = containerRef.value
  if (!el)
    return

  if (isAtBottom.value) {
    // 粘底：内容高度变化后继续跟随底部
    el.scrollTop = el.scrollHeight
  }
  else if (liveAnchorEventId) {
    // 有锚点：恢复锚点位置（防止内容膨胀导致跳动）
    scrollToPosition(liveAnchorEventId, liveAnchorOffset)
  }
  // 不再需要 fallback 分支：userInteracting 机制确保
  // 非用户操作不会把 isAtBottom 置 false
}

function setupResizeObserver() {
  const el = containerRef.value
  if (!el)
    return

  resizeObs = new ResizeObserver(onChildResize)

  for (const child of el.children) {
    resizeObs.observe(child)
  }

  mutationObs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node instanceof HTMLElement) {
          resizeObs?.observe(node)
        }
      }
    }
  })
  mutationObs.observe(el, { childList: true })
}

// ── 生命周期 ─────────────────────────────────────────────────

onMounted(() => {
  nextTick(() => scrollToBottom())

  // 监听用户主动滚动意图
  const el = containerRef.value
  if (el) {
    el.addEventListener('wheel', onUserScrollIntent, { passive: true })
    el.addEventListener('touchstart', onUserScrollIntent, { passive: true })
    el.addEventListener('keydown', onUserScrollIntent, { passive: true })
  }

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && !pendingRestore)
        triggerPagination()
    },
    { root: containerRef.value, threshold: 0 },
  )
  if (sentinelRef.value)
    observer.observe(sentinelRef.value)
  nextTick(() => setupResizeObserver())
})

onUnmounted(() => {
  observer?.disconnect()
  resizeObs?.disconnect()
  mutationObs?.disconnect()
  clearTimeout(userInteractingTimer)

  const el = containerRef.value
  if (el) {
    el.removeEventListener('wheel', onUserScrollIntent)
    el.removeEventListener('touchstart', onUserScrollIntent)
    el.removeEventListener('keydown', onUserScrollIntent)
  }
})
</script>

<template>
  <div
    ref="containerRef"
    class="flex-1 overflow-y-auto py-2 relative"
    :style="{
      overflowAnchor: 'none',
      visibility: isRestoring ? 'hidden' : 'visible',
    }"
    @scroll="onScroll"
  >
    <div ref="sentinelRef" class="h-1" />
    <div v-if="isLoading" class="text-center py-2">
      <span class="text-xs text-muted-foreground">{{ t("chat.loading") }}</span>
    </div>

    <!-- Message rendering: delegate grouping to MessageGroup -->
    <MessageGroup
      v-if="visibleMessages.length"
      :events="visibleMessages"
      :room-id="store.currentRoomId || ''"
      :unread-event-id="unreadEventId"
      @avatar-click="onAvatarClick"
      @user-click="onAvatarClick"
    />

    <ChannelWelcome
      v-else-if="!isLoading && store.currentRoomId"
      :room-id="store.currentRoomId"
    />

    <button
      v-if="showNewMsg"
      class="sticky bottom-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-full shadow-md flex items-center gap-1"
      @click="scrollToBottom"
    >
      <ChevronDown :size="14" />
      {{ t("chat.new_msg_btn") }}
    </button>

    <UserInfoPanel
      :room="null"
      :user-id="infoPanelUserId"
      :room-id="store.currentRoomId"
      :position="infoPanelPos"
      @close="closeInfoPanel"
    />
  </div>
</template>
