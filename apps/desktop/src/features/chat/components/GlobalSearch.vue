<script setup lang="ts">
import type { SidebarPreviewInput } from '@/features/chat/stores/chatStore';
import { getClient } from '@matrix/client';
import { findOrCreateDm, loadInboxEventContext } from '@matrix/index';
import { useContactList } from '@shared/composables/useContactList';
import { useVirtualizer } from '@tanstack/vue-virtual';
import { Search } from 'lucide-vue-next';
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
import { workspaceApps } from '@/app/components/workspace/navigation';
import { useSearchHistory } from '@/features/chat/composables/useSearchHistory';
import { useChatStore } from '@/features/chat/stores/chatStore';
import { useRetrievalStore } from '@/features/chat/stores/retrievalStore';

const emit = defineEmits<{
  close: [];
}>();

interface SearchResultAction {
  id: string;
  execute: () => void | Promise<void>;
}

interface SearchRoomResult {
  roomId: string;
  name?: string;
}

const { t, locale } = useI18n();

const router = useRouter();
const query = ref('');
const client = getClient();
const chatStore = useChatStore();
const contactList = useContactList();
const retrievalStore = useRetrievalStore();
const searchHistory = useSearchHistory();
const resultsScrollRef = ref<HTMLElement | null>(null);
const searchInputRef = useTemplateRef<HTMLInputElement>('searchInput');
const activeResultIndex = ref(-1);

const MESSAGE_HIT_HEIGHT = 88;
const PRELOAD_TIMEOUT_MS = 250;
const FALLBACK_VISIBLE_COUNT = 24;

const joinedRoomIds = computed(
  () =>
    new Set(
      client
        .getRooms()
        .filter((r) => r.getMyMembership() === 'join')
        .map((r) => r.roomId),
    ),
);

const normalizedQuery = computed(() => query.value.trim().toLowerCase());

const appResults = computed(() => {
  const q = normalizedQuery.value;
  return workspaceApps
    .filter((app) => {
      if (!q) return true;
      return t(app.labelKey).toLowerCase().includes(q) || app.id.includes(q);
    })
    .map((app) => ({
      id: app.id,
      label: t(app.labelKey),
      path: app.path,
      icon: app.icon,
    }));
});

const rooms = computed(() => {
  const all = client.getRooms().filter((r) => joinedRoomIds.value.has(r.roomId));
  if (!normalizedQuery.value) return all.slice(0, 10);
  const q = normalizedQuery.value;
  return all.filter((r) => (r.name || '').toLowerCase().includes(q) || r.roomId.toLowerCase().includes(q)).slice(0, 10);
});

const contactResults = computed(() => {
  const q = normalizedQuery.value;
  if (!q) return contactList.contacts.slice(0, 8);

  return contactList.contacts
    .filter((contact) => contact.displayName.toLowerCase().includes(q) || contact.userId.toLowerCase().includes(q))
    .slice(0, 8);
});

const messageHits = computed(() => retrievalStore.results.filter((hit) => joinedRoomIds.value.has(hit.roomId)));
const hasAnySearchResult = computed(
  () =>
    appResults.value.length > 0 ||
    rooms.value.length > 0 ||
    contactResults.value.length > 0 ||
    messageHits.value.length > 0,
);
const messageHitVirtualizer = useVirtualizer(
  computed(() => ({
    count: messageHits.value.length,
    getScrollElement: () => resultsScrollRef.value,
    estimateSize: () => MESSAGE_HIT_HEIGHT,
    overscan: 6,
  })),
);
const virtualMessageHits = computed(() => {
  const measuredItems = messageHitVirtualizer.value.getVirtualItems();
  if (measuredItems.length > 0) return measuredItems;

  return messageHits.value.slice(0, FALLBACK_VISIBLE_COUNT).map((_, index) => ({
    index,
    start: index * MESSAGE_HIT_HEIGHT,
  }));
});
const messageHitTotalHeight = computed(() => {
  const measuredHeight = messageHitVirtualizer.value.getTotalSize();
  if (measuredHeight > 0) return measuredHeight;
  return messageHits.value.length * MESSAGE_HIT_HEIGHT;
});

function timeoutAfter(ms: number) {
  return new Promise<'timeout'>((resolve) => setTimeout(resolve, ms, 'timeout'));
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(locale.value, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function roomLabel(roomId: string): string {
  return client.getRoom(roomId)?.name || roomId;
}

async function openApp(path: string) {
  await router.push(path);
  emit('close');
}

async function selectRoom(room: SearchRoomResult, sidebarPreview: SidebarPreviewInput = {}) {
  chatStore.setCurrentRoom(room.roomId, {
    sidebarPlacement: 'promote',
    sidebarPreview: {
      name: room.name || room.roomId,
      ...sidebarPreview,
    },
  });
  await router.push(`/dm/${encodeURIComponent(room.roomId)}`);
  emit('close');
}

async function submitSearch() {
  searchHistory.record(query.value);
  await retrievalStore.search(query.value);
  await nextTick();
  activeResultIndex.value = hasAnySearchResult.value ? 0 : -1;
}

function runRecentSearch(term: string) {
  query.value = term;
  void submitSearch();
}

async function loadMore() {
  await retrievalStore.loadMore();
}

async function jumpToResult(roomId: string, eventId: string) {
  await Promise.race([
    loadInboxEventContext(roomId, eventId).catch((error) => {
      console.warn('[global-search] failed to preload context, fallback to direct navigation', {
        roomId,
        eventId,
        error,
      });
      return 'failed' as const;
    }),
    timeoutAfter(PRELOAD_TIMEOUT_MS),
  ]);

  await router.push({
    path: `/dm/${encodeURIComponent(roomId)}`,
    query: {
      focusEventId: eventId,
    },
  });
  emit('close');
}

async function selectContact(contact: { userId: string; displayName?: string; avatarUrl?: string }) {
  try {
    const roomId = await findOrCreateDm(contact.userId);
    await selectRoom(
      {
        roomId,
        name: contact.displayName,
      },
      {
        name: contact.displayName,
        avatar: contact.avatarUrl,
        dmUserId: contact.userId,
        dmUserAvatar: contact.avatarUrl,
        isDirect: true,
      },
    );
  } catch (error) {
    console.warn('[global-search] failed to start direct message from contact result', {
      userId: contact.userId,
      error,
    });
    toast.error(t('chat.open_dm_failed'));
  }
}

const resultActions = computed<SearchResultAction[]>(() => [
  ...appResults.value.map((app) => ({
    id: `app:${app.id}`,
    execute: () => openApp(app.path),
  })),
  ...rooms.value.map((room) => ({
    id: `room:${room.roomId}`,
    execute: () => selectRoom(room),
  })),
  ...contactResults.value.map((contact) => ({
    id: `contact:${contact.userId}`,
    execute: () => selectContact(contact),
  })),
  ...messageHits.value.map((hit) => ({
    id: `message:${hit.eventId}`,
    execute: () => jumpToResult(hit.roomId, hit.eventId),
  })),
]);

function isActiveResult(id: string): boolean {
  return resultActions.value[activeResultIndex.value]?.id === id;
}

function moveActiveResult(delta: number): void {
  const total = resultActions.value.length;
  if (total === 0) {
    activeResultIndex.value = -1;
    return;
  }
  const current = activeResultIndex.value < 0 ? 0 : activeResultIndex.value;
  activeResultIndex.value = (current + delta + total) % total;
}

function onSearchKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.isComposing) return;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveActiveResult(1);
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveActiveResult(-1);
    return;
  }

  if (event.key !== 'Enter' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const activeResult = resultActions.value[activeResultIndex.value];
  if (!activeResult) return;

  event.preventDefault();
  void activeResult.execute();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}

watch(
  () => resultActions.value.length,
  (length) => {
    if (length === 0) {
      activeResultIndex.value = -1;
      return;
    }

    if (activeResultIndex.value < 0) {
      activeResultIndex.value = 0;
      return;
    }

    if (activeResultIndex.value >= length) activeResultIndex.value = length - 1;
  },
  { immediate: true },
);

watch(normalizedQuery, () => {
  activeResultIndex.value = resultActions.value.length > 0 ? 0 : -1;
});

onMounted(() => {
  // Reset retrieval state on open so stale results are never shown
  retrievalStore.resetState();
  query.value = '';
  void contactList.loadContacts().catch(() => {});
  void contactList.loadGroups().catch(() => {});
  void nextTick(() => searchInputRef.value?.focus());
  document.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown);
  // Clean up retrieval state on close
  retrievalStore.resetState();
});
</script>

<template>
  <div class="flex h-full w-full flex-col" @keydown.capture="onSearchKeydown">
    <div class="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
      <Search :size="16" class="text-muted-foreground shrink-0" />
      <form
        data-testid="global-search-form"
        class="flex min-w-0 flex-1 items-center gap-2"
        @submit.prevent="submitSearch"
      >
        <input
          ref="searchInput"
          v-model="query"
          data-testid="global-search-input"
          type="text"
          :placeholder="t('chat.global_search_placeholder')"
          class="h-9 min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-sm leading-9 outline-none placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <button
          type="submit"
          class="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!query.trim() || retrievalStore.loading"
        >
          {{ t('chat.search_btn') }}
        </button>
      </form>
    </div>

    <div ref="resultsScrollRef" class="flex-1 overflow-y-auto py-1">
      <!-- 最近搜索（飞书：空查询时展示历史词） -->
      <div
        v-if="!normalizedQuery && searchHistory.history.value.length > 0"
        data-testid="search-recent"
        class="px-3 py-2"
      >
        <div class="mb-1.5 flex items-center justify-between">
          <span class="text-xs font-medium text-muted-foreground">{{ t('chat.recent_searches') }}</span>
          <button
            type="button"
            class="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            data-testid="search-recent-clear"
            @click="searchHistory.clear()"
          >
            {{ t('chat.search_history_clear') }}
          </button>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="term in searchHistory.history.value"
            :key="term"
            type="button"
            class="rounded-full bg-accent px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent/70"
            data-testid="search-recent-term"
            @click="runRecentSearch(term)"
          >
            {{ term }}
          </button>
        </div>
      </div>

      <template v-if="appResults.length > 0">
        <div class="px-3 py-2 text-xs font-medium text-muted-foreground">
          {{ t('chat.search_apps') }}
        </div>
        <button
          v-for="app in appResults"
          :key="app.id"
          type="button"
          :data-testid="`global-search-app-${app.id}`"
          class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
          :class="isActiveResult(`app:${app.id}`) ? 'bg-accent text-foreground' : 'hover:bg-accent/50'"
          :aria-selected="isActiveResult(`app:${app.id}`)"
          @click="openApp(app.path)"
        >
          <div class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <component :is="app.icon" :size="16" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm">
              {{ app.label }}
            </div>
          </div>
        </button>
      </template>

      <template v-if="rooms.length > 0">
        <div
          class="px-3 py-2 text-xs font-medium text-muted-foreground"
          :class="appResults.length > 0 ? 'border-t border-border/60 mt-1 pt-3' : ''"
        >
          {{ t('chat.search_conversations_title') }}
        </div>
        <button
          v-for="r in rooms"
          :key="r.roomId"
          type="button"
          :data-testid="`global-search-room-${r.roomId}`"
          class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
          :class="isActiveResult(`room:${r.roomId}`) ? 'bg-accent text-foreground' : 'hover:bg-accent/50'"
          :aria-selected="isActiveResult(`room:${r.roomId}`)"
          @click="selectRoom(r)"
        >
          <div
            class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary"
          >
            {{ (r.name || '?').slice(0, 1) }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm">
              {{ r.name || r.roomId }}
            </div>
            <div class="truncate text-xs text-muted-foreground">
              {{ r.roomId }}
            </div>
          </div>
        </button>
      </template>

      <template v-if="contactResults.length > 0">
        <div class="mt-1 border-t border-border/60 px-3 pb-2 pt-3 text-xs font-medium text-muted-foreground">
          {{ t('contacts.contacts') }}
        </div>
        <button
          v-for="contact in contactResults"
          :key="contact.userId"
          type="button"
          :data-testid="`global-search-contact-${contact.userId}`"
          class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
          :class="isActiveResult(`contact:${contact.userId}`) ? 'bg-accent text-foreground' : 'hover:bg-accent/50'"
          :aria-selected="isActiveResult(`contact:${contact.userId}`)"
          @click="selectContact(contact)"
        >
          <div
            class="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
          >
            {{ (contact.displayName || contact.userId || '?').slice(0, 1) }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm">
              {{ contact.displayName }}
            </div>
            <div class="truncate text-xs text-muted-foreground">
              {{ contact.userId }}
            </div>
          </div>
        </button>
      </template>

      <div class="px-3 pt-3 pb-2 text-xs font-medium text-muted-foreground border-t border-border mt-1">
        {{ t('chat.search_messages_global_title') }}
      </div>

      <div v-if="retrievalStore.loading" class="px-3 py-3 text-sm text-muted-foreground">
        {{ t('chat.searching') }}
      </div>

      <div v-if="messageHits.length > 0" class="relative" :style="{ height: `${messageHitTotalHeight}px` }">
        <div
          v-for="virtualItem in virtualMessageHits"
          :key="messageHits[virtualItem.index]?.eventId"
          :data-testid="`global-search-hit-${messageHits[virtualItem.index]?.eventId}`"
          class="absolute left-0 top-0 w-full cursor-pointer border-b border-border/40 px-3 py-2.5 transition-colors"
          :class="
            messageHits[virtualItem.index] && isActiveResult(`message:${messageHits[virtualItem.index]!.eventId}`)
              ? 'bg-accent text-foreground'
              : 'hover:bg-accent/50'
          "
          :style="{ transform: `translateY(${virtualItem.start}px)` }"
          @click="
            messageHits[virtualItem.index] &&
            jumpToResult(messageHits[virtualItem.index]!.roomId, messageHits[virtualItem.index]!.eventId)
          "
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
        class="px-3 py-4 text-sm text-muted-foreground"
      >
        <div>{{ t('chat.search_no_result') }}</div>
        <div class="text-xs mt-1">
          {{ t('chat.search_encrypted_hint') }}
        </div>
      </div>

      <div v-if="retrievalStore.error" class="px-3 py-3 text-sm text-destructive">
        {{ retrievalStore.error }}
      </div>

      <div
        v-if="query.trim() && !retrievalStore.loading && !retrievalStore.hasSearched && !hasAnySearchResult"
        class="px-3 py-6 text-center text-sm text-muted-foreground"
      >
        {{ t('chat.search_no_match') }}
      </div>

      <div v-if="retrievalStore.canLoadMore" class="px-3 py-3">
        <button
          class="w-full text-xs rounded-md border border-border px-3 py-2 hover:bg-accent/40 disabled:opacity-50"
          :disabled="retrievalStore.loadingMore"
          @click="loadMore"
        >
          {{ retrievalStore.loadingMore ? t('chat.searching') : t('chat.search_load_more') }}
        </button>
      </div>
    </div>
  </div>
</template>
