<script setup lang="ts">
import type { ReminderPreset } from '../types/defer'
import type { InboxFilterType, UnifiedInboxItem } from '../types/unifiedInbox'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUnifiedInbox } from '../composables/useUnifiedInbox'
import { useDeferStore } from '../stores/deferStore'
import { useInboxStore } from '../stores/inboxStore'

const emit = defineEmits<{
  jump: [payload: { roomId: string, eventId: string }]
}>()

const { t } = useI18n()
const store = useInboxStore()
const deferStore = useDeferStore()
const { items, counts, isLoading } = useUnifiedInbox()

const deferMenuItemId = ref<string | null>(null)
const customInputByItemId = ref<Record<string, string>>({})
const scrollRef = ref<HTMLElement | null>(null)

const ITEM_HEIGHT = 88
const FALLBACK_VISIBLE_COUNT = 24

const deferPresetOptions: Array<{ key: Exclude<ReminderPreset, 'custom' | 'later-today' | 'next-week'>, actionId: string, labelKey: string }> = [
  { key: 'in-1-hour', actionId: '1h', labelKey: 'chat.defer_preset_1h' },
  { key: 'tonight', actionId: 'tonight', labelKey: 'chat.defer_preset_tonight' },
  { key: 'tomorrow-morning', actionId: 'tomorrow-morning', labelKey: 'chat.defer_preset_tomorrow_morning' },
  { key: 'tomorrow', actionId: 'tomorrow', labelKey: 'chat.defer_preset_tomorrow' },
]

const filterTabs: Array<{ key: InboxFilterType, label: string }> = [
  { key: 'all', label: t('chat.inbox_filter_all') },
  { key: 'mention', label: t('chat.inbox_filter_mention') },
  { key: 'priority-unread', label: t('chat.inbox_filter_priority') },
  { key: 'reply-needed', label: t('chat.inbox_filter_reply') },
]

const selectedCount = computed(() => store.selectedItemIds.size)
const virtualizer = useVirtualizer(computed(() => ({
  count: items.value.length,
  getScrollElement: () => scrollRef.value,
  estimateSize: () => ITEM_HEIGHT,
  overscan: 6,
})))
const virtualItems = computed(() => {
  const measuredItems = virtualizer.value.getVirtualItems()
  if (measuredItems.length > 0)
    return measuredItems

  return items.value.slice(0, FALLBACK_VISIBLE_COUNT).map((_, index) => ({
    index,
    start: index * ITEM_HEIGHT,
  }))
})
const totalHeight = computed(() => {
  const measuredHeight = virtualizer.value.getTotalSize()
  if (measuredHeight > 0)
    return measuredHeight
  return items.value.length * ITEM_HEIGHT
})

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

function toggleDeferMenu(itemId: string) {
  deferMenuItemId.value = deferMenuItemId.value === itemId ? null : itemId
}

function createDeferredByPreset(item: UnifiedInboxItem, preset: Exclude<ReminderPreset, 'custom'>, actionId: string) {
  deferStore.createDeferredItem({
    id: `inbox:${item.id}:${actionId}`,
    roomId: item.roomId,
    eventId: item.eventId,
    reminder: { preset },
  })
  deferMenuItemId.value = null
}

function submitCustomDefer(item: UnifiedInboxItem) {
  const customRaw = customInputByItemId.value[item.id]
  const dueAt = Date.parse(customRaw)
  if (!Number.isFinite(dueAt))
    return

  deferStore.createDeferredItem({
    id: `inbox:${item.id}:custom`,
    roomId: item.roomId,
    eventId: item.eventId,
    reminder: {
      preset: 'custom',
      dueAt,
    },
  })
  deferMenuItemId.value = null
}
</script>

<template>
  <section class="flex min-h-0 flex-col border-t border-border bg-sidebar" data-testid="unified-inbox-panel">
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

    <div v-if="isLoading" class="px-3 py-4 text-center text-xs text-muted-foreground">
      {{ t('chat.loading') }}
    </div>

    <div v-else-if="items.length === 0" class="px-3 py-4 text-center text-xs text-muted-foreground" data-testid="inbox-empty">
      {{ t('chat.inbox_empty') }}
    </div>

    <div v-else ref="scrollRef" class="min-h-0 flex-1 overflow-y-auto p-2" data-testid="inbox-list-scroll">
      <ul class="relative" :style="{ height: `${totalHeight}px` }" data-testid="inbox-list">
        <li
          v-for="virtualItem in virtualItems"
          :key="items[virtualItem.index]?.id"
          class="absolute left-0 top-0 w-full rounded-md border border-border/60 hover:bg-accent/50"
          :style="{ transform: `translateY(${virtualItem.start}px)` }"
          :data-testid="`inbox-item-${items[virtualItem.index]?.type}`"
        >
          <div v-if="items[virtualItem.index]" class="flex items-start gap-2 px-2 py-2">
            <input
              type="checkbox"
              class="mt-0.5"
              :checked="store.isSelected(items[virtualItem.index]!.id)"
              :data-testid="`inbox-select-${items[virtualItem.index]!.id}`"
              @change="toggleItemSelection(items[virtualItem.index]!.id)"
            >
            <button
              type="button"
              class="flex-1 min-w-0 text-left"
              :data-testid="`inbox-jump-${items[virtualItem.index]!.id}`"
              @click="onItemClick(items[virtualItem.index]!)"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-medium truncate">{{ items[virtualItem.index]!.roomName }}</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">{{ itemTypeLabel(items[virtualItem.index]!.type) }}</span>
              </div>
              <p class="text-xs text-muted-foreground truncate mt-1">
                {{ items[virtualItem.index]!.snippet || '...' }}
              </p>
            </button>

            <div class="relative shrink-0" @click.stop>
              <button
                type="button"
                class="text-[11px] px-2 py-1 rounded-md border border-border text-muted-foreground hover:bg-accent"
                :data-testid="`inbox-defer-trigger-${items[virtualItem.index]!.id}`"
                @click="toggleDeferMenu(items[virtualItem.index]!.id)"
              >
                {{ t('chat.defer') }}
              </button>

              <div
                v-if="deferMenuItemId === items[virtualItem.index]!.id"
                class="absolute right-0 top-full z-20 mt-1 w-44 rounded-md border border-border bg-sidebar p-2 shadow-lg"
              >
                <div class="space-y-1">
                  <button
                    v-for="preset in deferPresetOptions"
                    :key="preset.key"
                    type="button"
                    class="w-full rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                    :data-testid="`inbox-defer-preset-${preset.actionId}-${items[virtualItem.index]!.id}`"
                    @click="createDeferredByPreset(items[virtualItem.index]!, preset.key, preset.actionId)"
                  >
                    {{ t(preset.labelKey) }}
                  </button>
                </div>

                <div class="mt-2 border-t border-border/60 pt-2">
                  <button
                    type="button"
                    class="w-full rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                    :data-testid="`inbox-defer-custom-toggle-${items[virtualItem.index]!.id}`"
                  >
                    {{ t('chat.defer_custom') }}
                  </button>
                  <input
                    v-model="customInputByItemId[items[virtualItem.index]!.id]"
                    type="datetime-local"
                    class="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                    :data-testid="`inbox-defer-custom-input-${items[virtualItem.index]!.id}`"
                  >
                  <button
                    type="button"
                    class="mt-1 w-full rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
                    :disabled="!customInputByItemId[items[virtualItem.index]!.id]"
                    :data-testid="`inbox-defer-custom-submit-${items[virtualItem.index]!.id}`"
                    @click="submitCustomDefer(items[virtualItem.index]!)"
                  >
                    {{ t('common.confirm') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>
