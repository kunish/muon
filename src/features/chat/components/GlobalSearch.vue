<script setup lang="ts">
import { getClient } from '@matrix/client'
import { loadInboxEventContext } from '@matrix/index'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useRetrievalStore } from '@/features/chat/stores/retrievalStore'
import { Search } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

const router = useRouter()
const query = ref('')
const client = getClient()
const retrievalStore = useRetrievalStore()
const resultsScrollRef = ref<HTMLElement | null>(null)

const MESSAGE_HIT_HEIGHT = 88
const PRELOAD_TIMEOUT_MS = 250
const FALLBACK_VISIBLE_COUNT = 24

const joinedRoomIds = computed(() => new Set(
  client
    .getRooms()
    .filter(r => r.getMyMembership() === 'join')
    .map(r => r.roomId),
))

const rooms = computed(() => {
  const all = client.getRooms().filter(r => joinedRoomIds.value.has(r.roomId))
  if (!query.value.trim())
    return all.slice(0, 10)
  const q = query.value.toLowerCase()
  return all.filter(r =>
    (r.name || '').toLowerCase().includes(q)
    || r.roomId.toLowerCase().includes(q),
  )
})

const messageHits = computed(() => retrievalStore.results.filter(hit => joinedRoomIds.value.has(hit.roomId)))
const messageHitVirtualizer = useVirtualizer(computed(() => ({
  count: messageHits.value.length,
  getScrollElement: () => resultsScrollRef.value,
  estimateSize: () => MESSAGE_HIT_HEIGHT,
  overscan: 6,
})))
const virtualMessageHits = computed(() => {
  const measuredItems = messageHitVirtualizer.value.getVirtualItems()
  if (measuredItems.length > 0)
    return measuredItems

  return messageHits.value.slice(0, FALLBACK_VISIBLE_COUNT).map((_, index) => ({
    index,
    start: index * MESSAGE_HIT_HEIGHT,
  }))
})
const messageHitTotalHeight = computed(() => {
  const measuredHeight = messageHitVirtualizer.value.getTotalSize()
  if (measuredHeight > 0)
    return measuredHeight
  return messageHits.value.length * MESSAGE_HIT_HEIGHT
})

function timeoutAfter(ms: number) {
  return new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), ms))
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function roomLabel(roomId: string): string {
  return client.getRoom(roomId)?.name || roomId
}

function selectRoom(roomId: string) {
  router.push(`/chat/${encodeURIComponent(roomId)}`)
  emit('close')
}

async function submitSearch() {
  await retrievalStore.search(query.value)
}

async function loadMore() {
  await retrievalStore.loadMore()
}

async function jumpToResult(roomId: string, eventId: string) {
  await Promise.race([
    loadInboxEventContext(roomId, eventId).catch((error) => {
      console.warn('[global-search] failed to preload context, fallback to direct navigation', {
        roomId,
        eventId,
        error,
      })
      return 'failed' as const
    }),
    timeoutAfter(PRELOAD_TIMEOUT_MS),
  ])

  await router.push({
    path: `/chat/${encodeURIComponent(roomId)}`,
    query: {
      focusEventId: eventId,
    },
  })
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape')
    emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[15vh]" @click.self="emit('close')">
      <div class="bg-background rounded-xl shadow-2xl w-[480px] max-h-[60vh] flex flex-col">
        <div class="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search :size="16" class="text-muted-foreground shrink-0" />
          <form data-testid="global-search-form" class="flex-1 flex items-center gap-2" @submit.prevent="submitSearch">
            <input
              v-model="query"
              data-testid="global-search-input"
              type="text"
              :placeholder="t('chat.search_conversations')"
              class="flex-1 bg-transparent text-sm outline-none"
              autofocus
            >
            <button
              type="submit"
              class="text-xs rounded-md px-2 py-1 bg-primary text-primary-foreground disabled:opacity-50"
              :disabled="!query.trim() || retrievalStore.loading"
            >
              {{ t('chat.search_btn') }}
            </button>
          </form>
          <kbd class="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">ESC</kbd>
        </div>

        <div ref="resultsScrollRef" class="flex-1 overflow-y-auto py-1">
          <div class="px-4 py-2 text-xs font-medium text-muted-foreground">
            {{ t('chat.search_conversations') }}
          </div>
          <div
            v-for="r in rooms"
            :key="r.roomId"
            class="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-accent/50"
            @click="selectRoom(r.roomId)"
          >
            <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium shrink-0">
              {{ (r.name || '?').slice(0, 1) }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm truncate">
                {{ r.name || r.roomId }}
              </div>
            </div>
          </div>

          <div class="px-4 pt-3 pb-2 text-xs font-medium text-muted-foreground border-t border-border mt-1">
            {{ t('chat.search_messages_global_title') }}
          </div>

          <div v-if="retrievalStore.loading" class="px-4 py-3 text-sm text-muted-foreground">
            {{ t('chat.searching') }}
          </div>

          <div v-if="messageHits.length > 0" class="relative" :style="{ height: `${messageHitTotalHeight}px` }">
            <div
              v-for="virtualItem in virtualMessageHits"
              :key="messageHits[virtualItem.index]?.eventId"
              :data-testid="`global-search-hit-${messageHits[virtualItem.index]?.eventId}`"
              class="absolute left-0 top-0 w-full cursor-pointer border-b border-border/40 px-4 py-2.5 hover:bg-accent/50"
              :style="{ transform: `translateY(${virtualItem.start}px)` }"
              @click="messageHits[virtualItem.index] && jumpToResult(messageHits[virtualItem.index]!.roomId, messageHits[virtualItem.index]!.eventId)"
            >
              <div v-if="messageHits[virtualItem.index]" class="flex items-center justify-between gap-2 mb-1">
                <div class="text-xs font-medium truncate">
                  {{ roomLabel(messageHits[virtualItem.index]!.roomId) }}
                </div>
                <div class="text-xs text-muted-foreground shrink-0">
                  {{ formatTime(messageHits[virtualItem.index]!.ts) }}
                </div>
              </div>
              <div class="text-xs text-muted-foreground mb-1 truncate">
                {{ messageHits[virtualItem.index]?.sender }}
              </div>
              <div class="text-sm line-clamp-2">
                {{ messageHits[virtualItem.index]?.body }}
              </div>
            </div>
          </div>

          <div
            v-if="retrievalStore.hasSearched && !retrievalStore.loading && messageHits.length === 0"
            class="px-4 py-4 text-sm text-muted-foreground"
          >
            <div>{{ t('chat.search_no_result') }}</div>
            <div class="text-xs mt-1">
              {{ t('chat.search_encrypted_hint') }}
            </div>
          </div>

          <div v-if="retrievalStore.error" class="px-4 py-3 text-sm text-destructive">
            {{ retrievalStore.error }}
          </div>

          <div v-if="retrievalStore.canLoadMore" class="px-4 py-3">
            <button
              class="w-full text-xs rounded-md border border-border px-3 py-2 hover:bg-accent/40 disabled:opacity-50"
              :disabled="retrievalStore.loadingMore"
              @click="loadMore"
            >
              {{ retrievalStore.loadingMore ? t('chat.searching') : t('chat.search_load_more') }}
            </button>
          </div>

          <div
            v-if="rooms.length === 0 && !query.trim()"
            class="px-4 py-6 text-center text-sm text-muted-foreground"
          >
            {{ t('chat.search_no_match') }}
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
