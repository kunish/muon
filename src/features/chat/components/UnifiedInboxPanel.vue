<script setup lang="ts">
import type { InboxFilterType, UnifiedInboxItem } from '../types/unifiedInbox'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUnifiedInbox } from '../composables/useUnifiedInbox'
import { useInboxStore } from '../stores/inboxStore'

const emit = defineEmits<{
  jump: [payload: { roomId: string, eventId: string }]
}>()

const { t } = useI18n()
const store = useInboxStore()
const { items, counts, isLoading } = useUnifiedInbox()

const filterTabs: Array<{ key: InboxFilterType, label: string }> = [
  { key: 'all', label: t('chat.inbox_filter_all') },
  { key: 'mention', label: t('chat.inbox_filter_mention') },
  { key: 'priority-unread', label: t('chat.inbox_filter_priority') },
  { key: 'reply-needed', label: t('chat.inbox_filter_reply') },
]

const selectedCount = computed(() => store.selectedItemIds.size)

function itemTypeLabel(type: UnifiedInboxItem['type']) {
  if (type === 'mention')
    return t('chat.inbox_filter_mention')
  if (type === 'priority-unread')
    return t('chat.inbox_filter_priority')
  return t('chat.inbox_filter_reply')
}

function onItemClick(item: UnifiedInboxItem) {
  emit('jump', { roomId: item.roomId, eventId: item.eventId })
}

function toggleItemSelection(itemId: string) {
  store.toggleSelection(itemId)
}

function selectAllVisible() {
  store.selectAll(items.value.map(item => item.id))
}
</script>

<template>
  <section class="flex flex-col h-full border-t border-border bg-sidebar" data-testid="unified-inbox-panel">
    <div class="px-3 py-2 border-b border-border/60">
      <div class="flex items-center justify-between">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {{ t('chat.unified_inbox') }}
        </h3>
        <span class="text-xs text-muted-foreground" data-testid="inbox-count-all">{{ counts.all }}</span>
      </div>
      <div class="mt-2 flex flex-wrap gap-1">
        <button
          v-for="tab in filterTabs"
          :key="tab.key"
          type="button"
          class="px-2 py-1 text-[11px] rounded-md border transition-colors"
          :class="store.filter === tab.key
            ? 'bg-primary/10 border-primary/40 text-primary'
            : 'border-border text-muted-foreground hover:bg-accent'"
          :data-testid="`inbox-filter-${tab.key}`"
          @click="store.setFilter(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <div class="px-3 py-2 border-b border-border/60 flex items-center justify-between gap-2">
      <button
        type="button"
        class="text-xs text-muted-foreground hover:text-foreground"
        data-testid="inbox-select-all"
        @click="selectAllVisible"
      >
        {{ t('chat.inbox_select_all') }}
      </button>
      <button
        type="button"
        class="text-xs px-2 py-1 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
        :disabled="selectedCount === 0"
        data-testid="inbox-mark-processed"
        @click="store.markSelectedProcessed"
      >
        {{ t('chat.inbox_mark_processed') }} ({{ selectedCount }})
      </button>
    </div>

    <div v-if="isLoading" class="flex-1 flex items-center justify-center text-xs text-muted-foreground">
      {{ t('chat.loading') }}
    </div>

    <div v-else-if="items.length === 0" class="flex-1 flex items-center justify-center text-xs text-muted-foreground" data-testid="inbox-empty">
      {{ t('chat.inbox_empty') }}
    </div>

    <ul v-else class="flex-1 overflow-y-auto p-2 space-y-1" data-testid="inbox-list">
      <li
        v-for="item in items"
        :key="item.id"
        class="rounded-md border border-border/60 hover:bg-accent/50"
        :data-testid="`inbox-item-${item.type}`"
      >
        <div class="flex items-start gap-2 px-2 py-2">
          <input
            type="checkbox"
            class="mt-0.5"
            :checked="store.isSelected(item.id)"
            :data-testid="`inbox-select-${item.id}`"
            @change="toggleItemSelection(item.id)"
          >
          <button
            type="button"
            class="flex-1 min-w-0 text-left"
            :data-testid="`inbox-jump-${item.id}`"
            @click="onItemClick(item)"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-medium truncate">{{ item.roomName }}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">{{ itemTypeLabel(item.type) }}</span>
            </div>
            <p class="text-xs text-muted-foreground truncate mt-1">
              {{ item.snippet || '...' }}
            </p>
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>
