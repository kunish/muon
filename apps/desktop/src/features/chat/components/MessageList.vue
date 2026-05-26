<script setup lang="ts">
import type { MatrixEvent } from 'matrix-js-sdk';
import { getClient } from '@matrix/client';
import { getReadMarkerEventId, syncState } from '@matrix/index';
import { ChevronDown, Undo2 } from 'lucide-vue-next';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useMessages } from '../composables/useMessages';
import { useChatStore } from '../stores/chatStore';
import ChannelWelcome from './ChannelWelcome.vue';
import MessageGroup from './MessageGroup.vue';
import UserInfoPanel from './UserInfoPanel.vue';

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

const { messages, isLoading, hasMore, loadMore, relationSummaries, timelineVersion } = useMessages();
const store = useChatStore();
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const containerRef = ref<HTMLElement>();
const sentinelRef = ref<HTMLElement>();
const isAtBottom = ref(true);
const showNewMsg = ref(false);
const isPaginating = ref(false);

// 房间切换时隐藏消息列表内容，防止滚动恢复前的视觉跳动
const isRestoring = ref(false);

// 头像点击弹窗状态
const infoPanelUserId = ref<string | null>(null);
const infoPanelPos = ref({ x: 0, y: 0 });

function onAvatarClick(userId: string, event: MouseEvent) {
  const rect = (event.target as HTMLElement).getBoundingClientRect();
  infoPanelPos.value = { x: rect.right, y: rect.top };
  infoPanelUserId.value = userId;
}

function closeInfoPanel() {
  infoPanelUserId.value = null;
}

const visibleMessages = computed(
  () => messages.value.filter((ev) => !store.isHidden(ev.getId() || '')) as MatrixEvent[],
);

const currentUserId = computed(() => getClient().getUserId() || '');

function isCurrentUserEvent(event: MatrixEvent): boolean {
  const sender = event.getSender?.();
  if (sender) return sender === currentUserId.value;
  return event.isSending?.() === true;
}

const unreadEventId = computed(() => {
  const roomId = store.currentRoomId;
  if (!roomId) return null;
  const markerEventId = getReadMarkerEventId(roomId);
  if (!markerEventId) return null;
  const markerIdx = visibleMessages.value.findIndex((e) => e.getId() === markerEventId);
  if (markerIdx < 0 || markerIdx >= visibleMessages.value.length - 1) return null;
  const firstIncoming = visibleMessages.value.slice(markerIdx + 1).find((event) => !isCurrentUserEvent(event));
  // 未读分割线插在 marker 之后的第一条非自己消息前
  return firstIncoming?.getId() ?? null;
});

let observer: IntersectionObserver | null = null;
const pendingFocusEventId = ref<string | null>(null);
let focusFlashTimer = 0;
let bottomSettleFrame = 0;

// ── 锚点数据结构 ─────────────────────────────────────────────

interface ScrollAnchor {
  eventId: string;
  offset: number;
}

type ReturnPosition = { type: 'anchor'; anchor: ScrollAnchor } | { type: 'bottom' };

const returnPosition = ref<ReturnPosition | null>(null);
let skipReturnCaptureOnNextBottomJump = false;

// 实时锚点（每次用户滚动时更新）
let liveAnchorEventId: string | null = null;
let liveAnchorOffset = 0;

// 每个房间的保存状态（类似 ListMemento）
// undefined = 首次进入，null = 粘底，ScrollAnchor = 中间位置
const scrollStateMap = new Map<string, ScrollAnchor | null>();

const showJumpToBottom = computed(() => !isRestoring.value && !isAtBottom.value);
const showJumpToPrevious = computed(() => !isRestoring.value && returnPosition.value !== null);
const jumpToBottomLabel = computed(() => (showNewMsg.value ? t('chat.new_msg_btn') : t('chat.jump_to_bottom')));
const currentRoomIdForWelcome = computed(() => {
  if (!store.currentRoomId || isLoading.value) return null;
  if (syncState.value !== 'PREPARED' && syncState.value !== 'SYNCING') return null;
  return store.currentRoomId;
});

// 切换房间后等消息到达再恢复
// 此标志为 true 期间，onScroll / ResizeObserver 全部挂起
// （类似 Telegram 的 if (_scrollTopState.item) return 守卫）
let pendingRestore = false;
let pendingRestoreRoomId: string | null = null;
let restoreSessionVersion = 0;

function finishPendingRestore(resetBottomState = false) {
  if (resetBottomState) {
    liveAnchorEventId = null;
    liveAnchorOffset = 0;
    isAtBottom.value = true;
    showNewMsg.value = false;
  }
  pendingRestore = false;
  pendingRestoreRoomId = null;
  isRestoring.value = false;
}

async function finishEmptyPendingRestoreIfReady() {
  if (!pendingRestore || visibleMessages.value.length > 0) return false;

  await nextTick();

  if (!pendingRestore || visibleMessages.value.length > 0) return false;

  finishPendingRestore(true);
  return true;
}

// ── 用户输入检测 ──────────────────────────────────────────────
//
//  核心思路：不通过 scroll 事件判断"用户是否离开底部"，
//  而是通过 wheel/touchstart/keydown 直接检测用户输入。
//  只有用户主动操作时才允许 isAtBottom 变为 false。
//  这样 LinkPreview 等异步内容加载引起的被动 scroll
//  永远不会误判为"用户手动离开底部"。
//
let userInteracting = false;
let userInteractingTimer = 0;

function onUserScrollIntent() {
  skipReturnCaptureOnNextBottomJump = false;
  userInteracting = true;
  // 150ms 无输入后重置——覆盖惯性滚动拖尾
  clearTimeout(userInteractingTimer);
  userInteractingTimer = window.setTimeout(() => {
    userInteracting = false;
  }, 150);
}

function clearUserScrollIntent() {
  userInteracting = false;
  clearTimeout(userInteractingTimer);
}

// ── 锚点计算 ─────────────────────────────────────────────────

function findAnchorElement(el: HTMLElement, scrollTop: number): { eventId: string; offset: number } | null {
  const items = el.querySelectorAll<HTMLElement>('[data-event-id]');
  for (const item of items) {
    const top = item.offsetTop;
    if (top + item.offsetHeight > scrollTop) {
      const eid = item.dataset.eventId;
      if (eid) return { eventId: eid, offset: scrollTop - top };
    }
  }
  return null;
}

function isScrollerAtBottom(el: HTMLElement) {
  return el.scrollHeight - el.scrollTop - el.clientHeight < 50;
}

function getBottomScrollTop(el: HTMLElement) {
  return Math.max(0, el.scrollHeight - el.clientHeight);
}

function captureCurrentScrollState(): ScrollAnchor | null {
  const el = containerRef.value;
  if (!el) {
    return liveAnchorEventId ? { eventId: liveAnchorEventId, offset: liveAnchorOffset } : null;
  }

  if (isScrollerAtBottom(el)) {
    liveAnchorEventId = null;
    liveAnchorOffset = 0;
    isAtBottom.value = true;
    showNewMsg.value = false;
    return null;
  }

  const anchor = findAnchorElement(el, el.scrollTop);
  if (anchor) {
    liveAnchorEventId = anchor.eventId;
    liveAnchorOffset = anchor.offset;
    return anchor;
  }

  return liveAnchorEventId ? { eventId: liveAnchorEventId, offset: liveAnchorOffset } : null;
}

function alignToBottom() {
  const el = containerRef.value;
  if (!el) return;
  el.scrollTop = getBottomScrollTop(el);
  isAtBottom.value = true;
  liveAnchorEventId = null;
  liveAnchorOffset = 0;
  showNewMsg.value = false;
}

function cancelBottomSettle() {
  if (!bottomSettleFrame) return;
  window.cancelAnimationFrame(bottomSettleFrame);
  bottomSettleFrame = 0;
}

function scheduleBottomSettle(sessionVersion: number, frames = 2, onComplete?: () => void) {
  cancelBottomSettle();

  function step(remaining: number) {
    bottomSettleFrame = window.requestAnimationFrame(() => {
      bottomSettleFrame = 0;
      if (sessionVersion !== restoreSessionVersion || !isAtBottom.value) return;
      alignToBottom();
      if (remaining > 1) {
        step(remaining - 1);
        return;
      }
      onComplete?.();
    });
  }

  step(frames);
}

function scrollToPosition(eventId: string, offset: number) {
  const el = containerRef.value;
  if (!el) return false;

  const target = el.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(eventId)}"]`);
  if (!target) return false;

  el.scrollTop = target.offsetTop + offset;
  liveAnchorEventId = eventId;
  liveAnchorOffset = offset;
  isAtBottom.value = isScrollerAtBottom(el);
  if (isAtBottom.value) showNewMsg.value = false;
  return true;
}

function scrollToCenteredEvent(eventId: string, options: { rememberPrevious?: boolean } = {}) {
  const el = containerRef.value;
  if (!el) return false;
  const target = el.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(eventId)}"]`);
  if (!target) return false;

  if (options.rememberPrevious) rememberCurrentPositionForReturn();

  const containerRect = el.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const containerCenterY = containerRect.top + containerRect.height / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;
  const delta = targetCenterY - containerCenterY;
  const nextTop = el.scrollTop + delta;
  const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
  el.scrollTop = Math.min(Math.max(0, nextTop), maxTop);

  const anchorOffset = el.scrollTop - target.offsetTop;
  liveAnchorEventId = eventId;
  liveAnchorOffset = anchorOffset;
  isAtBottom.value = isScrollerAtBottom(el);
  if (isAtBottom.value) showNewMsg.value = false;

  return true;
}

function flashFocusedEvent(eventId: string) {
  const el = containerRef.value;
  if (!el) return;
  const target = el.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(eventId)}"]`);
  if (!target) return;
  target.classList.add('focused-event-flash');
  clearTimeout(focusFlashTimer);
  focusFlashTimer = window.setTimeout(() => {
    target.classList.remove('focused-event-flash');
  }, 1200);
}

function rememberCurrentPositionForReturn() {
  const el = containerRef.value;
  if (el && isScrollerAtBottom(el)) {
    returnPosition.value = { type: 'bottom' };
    return;
  }

  const anchor = captureCurrentScrollState();
  if (anchor) returnPosition.value = { type: 'anchor', anchor };
}

function scrollToBottom(options: { rememberPrevious?: boolean } = {}) {
  if (options.rememberPrevious) rememberCurrentPositionForReturn();
  clearUserScrollIntent();
  alignToBottom();
}

function jumpToBottom() {
  const el = containerRef.value;
  if (el && isScrollerAtBottom(el)) {
    skipReturnCaptureOnNextBottomJump = false;
    returnPosition.value = null;
    scrollToBottom();
    return;
  }

  const rememberPrevious = !skipReturnCaptureOnNextBottomJump;
  skipReturnCaptureOnNextBottomJump = false;
  if (!rememberPrevious) returnPosition.value = null;
  scrollToBottom({ rememberPrevious });
}

function jumpToPreviousPosition() {
  const position = returnPosition.value;
  if (!position) return;
  returnPosition.value = null;
  clearUserScrollIntent();

  if (position.type === 'bottom') {
    scrollToBottom();
    return;
  }

  skipReturnCaptureOnNextBottomJump = true;
  if (scrollToPosition(position.anchor.eventId, position.anchor.offset)) {
    showNewMsg.value = false;
  }
}

async function restorePendingScrollIfReady() {
  if (!pendingRestore) return false;

  const roomId = pendingRestoreRoomId;
  const sessionVersion = restoreSessionVersion;
  await nextTick();

  if (
    !pendingRestore ||
    sessionVersion !== restoreSessionVersion ||
    roomId !== pendingRestoreRoomId ||
    roomId !== store.currentRoomId
  ) {
    return true;
  }

  let restoredStickyBottom = false;

  if (roomId && scrollStateMap.has(roomId)) {
    const saved = scrollStateMap.get(roomId);
    if (saved) {
      const ok = scrollToPosition(saved.eventId, saved.offset);
      if (!ok) {
        scrollToBottom();
        restoredStickyBottom = true;
      }
    } else {
      // null = 之前粘底
      scrollToBottom();
      restoredStickyBottom = true;
    }
  } else {
    // 首次进入，滚到底部；空 timeline 也必须结束恢复态以显示欢迎页
    scrollToBottom();
    restoredStickyBottom = true;
  }

  // 解锁滚动处理；sticky-bottom 的后续布局帧完成前仍保持隐藏，避免看到 timeline 自己跳动。
  pendingRestore = false;
  pendingRestoreRoomId = null;
  if (restoredStickyBottom && visibleMessages.value.length > 0) {
    scheduleBottomSettle(sessionVersion, 2, () => {
      if (sessionVersion === restoreSessionVersion) isRestoring.value = false;
    });
  } else {
    isRestoring.value = false;
  }
  return true;
}

async function clearFocusQuery() {
  const nextQuery = { ...route.query };
  delete nextQuery.focusEventId;
  await router.replace({ query: nextQuery });
}

async function tryFocusEventFromQuery() {
  const focusEventId = pendingFocusEventId.value;
  if (!focusEventId) return;

  await nextTick();
  const focused = scrollToCenteredEvent(focusEventId, { rememberPrevious: true });
  if (focused) {
    flashFocusedEvent(focusEventId);
    pendingFocusEventId.value = null;
    await clearFocusQuery();
    return;
  }

  if (hasMore.value && !isPaginating.value && !isLoading.value) {
    await triggerPagination();
  }
}

function onScroll() {
  if (pendingRestore) return;

  const el = containerRef.value;
  if (!el) return;

  const atBot = isScrollerAtBottom(el);

  if (atBot) {
    liveAnchorEventId = null;
    liveAnchorOffset = 0;
    isAtBottom.value = true;
    showNewMsg.value = false;
    return;
  }

  if (userInteracting) {
    isAtBottom.value = false;
    const anchor = findAnchorElement(el, el.scrollTop);
    if (anchor) {
      liveAnchorEventId = anchor.eventId;
      liveAnchorOffset = anchor.offset;
    }
  }

  // 兜底：滚到顶部时主动触发分页，避免 IntersectionObserver 偶发不触发
  if (el.scrollTop <= 24 && !isPaginating.value && hasMore.value) {
    void triggerPagination();
  }
}

// ── 分页 ─────────────────────────────────────────────────────

async function triggerPagination() {
  if (isPaginating.value || !hasMore.value || isLoading.value) return;
  const roomId = store.currentRoomId;
  if (!roomId) return;
  const sessionVersion = restoreSessionVersion;
  const el = containerRef.value;
  if (!el) return;

  const wasAtBottom = isScrollerAtBottom(el);

  let savedId = liveAnchorEventId;
  let savedOff = liveAnchorOffset;

  // 某些输入方式（如拖拽滚动条）可能尚未写入 liveAnchor，
  // 分页前兜底取当前视口锚点，避免分页后误回到底部。
  if (!wasAtBottom && !savedId) {
    const fallbackAnchor = findAnchorElement(el, el.scrollTop);
    if (fallbackAnchor) {
      savedId = fallbackAnchor.eventId;
      savedOff = fallbackAnchor.offset;
    }
  }

  isPaginating.value = true;
  try {
    const didLoad = await loadMore();
    if (!didLoad) return;
    await nextTick();

    if (sessionVersion !== restoreSessionVersion || roomId !== store.currentRoomId) return;

    if (savedId) {
      scrollToPosition(savedId, savedOff);
    } else if (wasAtBottom) {
      scrollToBottom();
    }
  } finally {
    if (sessionVersion === restoreSessionVersion && roomId === store.currentRoomId) isPaginating.value = false;
  }

  await nextTick();
  if (sessionVersion === restoreSessionVersion && roomId === store.currentRoomId) {
    if (sentinelRef.value && hasMore.value) {
      const rect = sentinelRef.value.getBoundingClientRect();
      const containerRect = el.getBoundingClientRect();
      if (rect.bottom >= containerRect.top && rect.top <= containerRect.bottom) {
        void triggerPagination();
      }
    }
  }
}

// ── 房间切换 ─────────────────────────────────────────────────

watch(
  () => store.currentRoomId,
  (newId, oldId) => {
    // 保存旧房间锚点
    if (oldId) {
      scrollStateMap.set(oldId, captureCurrentScrollState());
    }

    // 挂起所有滚动处理，直到恢复完成
    clearUserScrollIntent();
    cancelBottomSettle();
    restoreSessionVersion++;
    pendingRestore = true;
    pendingRestoreRoomId = newId || null;
    liveAnchorEventId = null;
    liveAnchorOffset = 0;
    returnPosition.value = null;
    skipReturnCaptureOnNextBottomJump = false;
    showNewMsg.value = false;
    isPaginating.value = false;

    // 隐藏消息列表内容，防止滚动恢复前的视觉跳动
    // visibility:hidden 保留布局占位，不会触发重排
    isRestoring.value = true;

    void nextTick().then(() => finishEmptyPendingRestoreIfReady());
  },
  { flush: 'sync' },
);

// 消息到达后恢复滚动位置
// 必须 watch 数组引用而非 .length：原子性切换时新旧房间消息数可能相同，
// .length 不变则 watcher 不触发，pendingRestore 永远为 true
watch(visibleMessages, async (newArr, oldArr) => {
  const newLen = newArr.length;
  const oldLen = oldArr?.length ?? 0;
  if (await restorePendingScrollIfReady()) return;

  // 普通新消息到达
  if (newLen > (oldLen || 0) && !isPaginating.value) {
    if (isAtBottom.value) {
      await nextTick();
      scrollToBottom();
    } else {
      showNewMsg.value = true;
    }
  }

  if (pendingFocusEventId.value) {
    await tryFocusEventFromQuery();
  }
});

watch(isLoading, async () => {
  await restorePendingScrollIfReady();
});

watch(
  () => route.query.focusEventId,
  async (value) => {
    pendingFocusEventId.value = typeof value === 'string' ? value : null;
    if (pendingFocusEventId.value) {
      await tryFocusEventFromQuery();
    }
  },
  { immediate: true },
);

// ── ResizeObserver ────────────────────────────────────────────

let resizeObs: ResizeObserver | null = null;
let mutationObs: MutationObserver | null = null;

// ResizeObserver 回调在布局完成后、绘制前触发，
// 直接同步修正 scrollTop 即可在同一帧内生效，
// 无需 requestAnimationFrame（RAF 会延迟到下一帧，导致 1 帧跳动）
function onChildResize() {
  if (pendingRestore || isPaginating.value) return;

  const el = containerRef.value;
  if (!el) return;

  if (isAtBottom.value) {
    // 粘底：内容高度变化后继续跟随底部
    alignToBottom();
  } else if (liveAnchorEventId) {
    // 有锚点：恢复锚点位置（防止内容膨胀导致跳动）
    scrollToPosition(liveAnchorEventId, liveAnchorOffset);
  }
  // 不再需要 fallback 分支：userInteracting 机制确保
  // 非用户操作不会把 isAtBottom 置 false
}

function setupResizeObserver() {
  const el = containerRef.value;
  if (!el) return;

  resizeObs = new ResizeObserver(onChildResize);

  for (const child of el.children) {
    resizeObs.observe(child);
  }
  resizeObs.observe(el);

  mutationObs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node instanceof HTMLElement) {
          resizeObs?.observe(node);
        }
      }
    }
  });
  mutationObs.observe(el, { childList: true });
}

// ── 生命周期 ─────────────────────────────────────────────────

onMounted(() => {
  nextTick(() => scrollToBottom());

  // 监听用户主动滚动意图
  const el = containerRef.value;
  if (el) {
    el.addEventListener('wheel', onUserScrollIntent, { passive: true });
    el.addEventListener('pointerdown', onUserScrollIntent, { passive: true });
    el.addEventListener('touchstart', onUserScrollIntent, { passive: true });
    el.addEventListener('keydown', onUserScrollIntent, { passive: true });
  }

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && !pendingRestore) triggerPagination();
    },
    { root: containerRef.value, threshold: 0 },
  );
  if (sentinelRef.value) observer.observe(sentinelRef.value);
  nextTick(() => setupResizeObserver());
});

onUnmounted(() => {
  observer?.disconnect();
  resizeObs?.disconnect();
  mutationObs?.disconnect();
  cancelBottomSettle();
  clearTimeout(userInteractingTimer);
  clearTimeout(focusFlashTimer);

  const el = containerRef.value;
  if (el) {
    el.removeEventListener('wheel', onUserScrollIntent);
    el.removeEventListener('pointerdown', onUserScrollIntent);
    el.removeEventListener('touchstart', onUserScrollIntent);
    el.removeEventListener('keydown', onUserScrollIntent);
  }
});
</script>

<template>
  <div class="relative min-h-0 flex-1" :style="{ visibility: isRestoring ? 'hidden' : 'visible' }">
    <div
      ref="containerRef"
      data-testid="message-list-scroller"
      class="relative h-full min-h-0 overflow-y-auto py-2"
      :style="{
        overflowAnchor: 'none',
        visibility: isRestoring ? 'hidden' : 'visible',
      }"
      @scroll="onScroll"
    >
      <div ref="sentinelRef" class="h-1" />
      <div v-if="isLoading" class="text-center py-2">
        <span class="text-xs text-muted-foreground">{{ t('chat.loading') }}</span>
      </div>

      <!-- Message rendering: delegate grouping to MessageGroup -->
      <MessageGroup
        v-if="visibleMessages.length"
        :events="visibleMessages"
        :room-id="store.currentRoomId || ''"
        :reactions-by-event-id="relationSummaries.reactionsByEventId"
        :thread-reply-counts-by-event-id="relationSummaries.threadReplyCountsByEventId"
        :timeline-version="timelineVersion"
        :unread-event-id="unreadEventId"
        @avatar-click="onAvatarClick"
        @user-click="onAvatarClick"
      />

      <ChannelWelcome v-else-if="currentRoomIdForWelcome" :room-id="currentRoomIdForWelcome" />

      <UserInfoPanel
        :room="null"
        :user-id="infoPanelUserId"
        :room-id="store.currentRoomId"
        :position="infoPanelPos"
        @close="closeInfoPanel"
      />
    </div>

    <div
      v-if="showJumpToBottom || showJumpToPrevious"
      class="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex flex-col items-center gap-2"
    >
      <button
        v-if="showJumpToPrevious"
        data-testid="timeline-jump-to-previous"
        class="pointer-events-auto flex items-center gap-1 rounded-full border border-border/60 bg-background/95 px-3 py-1.5 text-xs text-foreground shadow-md backdrop-blur transition-colors hover:bg-accent"
        :aria-label="t('chat.jump_to_previous')"
        @click="jumpToPreviousPosition"
      >
        <Undo2 :size="14" />
        {{ t('chat.jump_to_previous') }}
      </button>

      <button
        v-if="showJumpToBottom"
        data-testid="timeline-jump-to-bottom"
        class="pointer-events-auto flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
        :aria-label="jumpToBottomLabel"
        @click="jumpToBottom"
      >
        <ChevronDown :size="14" />
        {{ jumpToBottomLabel }}
      </button>
    </div>
  </div>
</template>
