<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDeferStore } from '../stores/deferStore'

const { t } = useI18n()
const deferStore = useDeferStore()
const activeTab = ref<'active' | 'history'>('active')

const now = computed(() => Date.now())

function formatDueAt(dueAt: number) {
  return new Date(dueAt).toLocaleString()
}

function isOverdue(dueAt: number) {
  return dueAt <= now.value
}
</script>

<template>
  <section class="min-h-0 border-t border-border/60 px-2 py-2" data-testid="defer-queue-panel">
    <div class="flex items-center justify-between">
      <h3 class="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {{ t('chat.defer_queue_title') }}
      </h3>
      <span class="text-[10px] text-muted-foreground">{{ deferStore.activeItems.length }}</span>
    </div>

    <div class="mt-2 grid grid-cols-2 gap-1 rounded-md border border-border/60 p-1">
      <button
        type="button"
        class="rounded px-2 py-1 text-xs"
        :class="activeTab === 'active'
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-accent'"
        data-testid="defer-active-tab"
        @click="activeTab = 'active'"
      >
        {{ t('chat.defer_active') }}
      </button>
      <button
        type="button"
        class="rounded px-2 py-1 text-xs"
        :class="activeTab === 'history'
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-accent'"
        data-testid="defer-history-tab"
        @click="activeTab = 'history'"
      >
        {{ t('chat.defer_history') }}
      </button>
    </div>

    <div
      v-if="activeTab === 'active'"
      class="mt-2 max-h-56 overflow-y-auto pr-1"
      data-testid="defer-active-scroll-container"
    >
      <ul
        class="space-y-1"
        data-testid="defer-active-list"
      >
        <li
          v-for="item in deferStore.activeItems"
          :key="item.id"
          :data-testid="`defer-active-item-${item.id}`"
          class="rounded-md border border-border/60 px-2 py-1"
        >
          <p class="truncate text-xs text-foreground">
            {{ item.eventId }}
          </p>
          <p
            class="text-[11px]"
            :class="isOverdue(item.dueAt) ? 'text-destructive font-medium' : 'text-muted-foreground'"
          >
            {{ isOverdue(item.dueAt) ? t('chat.defer_overdue') : t('chat.defer_due') }}: {{ formatDueAt(item.dueAt) }}
          </p>
          <div class="mt-1 flex gap-1">
            <button
              type="button"
              class="rounded bg-accent px-2 py-0.5 text-[11px] text-foreground"
              :data-testid="`defer-complete-${item.id}`"
              @click="deferStore.markCompleted(item.id)"
            >
              {{ t('chat.defer_mark_completed') }}
            </button>
            <button
              type="button"
              class="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
              :data-testid="`defer-archive-${item.id}`"
              @click="deferStore.markArchived(item.id)"
            >
              {{ t('chat.defer_archive') }}
            </button>
          </div>
        </li>

        <li v-if="deferStore.activeItems.length === 0" class="px-2 py-2 text-xs text-muted-foreground">
          {{ t('chat.defer_empty_active') }}
        </li>
      </ul>
    </div>

    <div
      v-else
      class="mt-2 max-h-56 overflow-y-auto pr-1"
      data-testid="defer-history-scroll-container"
    >
      <ul
        class="space-y-1"
        data-testid="defer-history-list"
      >
        <li
          v-for="item in deferStore.historyItems"
          :key="item.id"
          :data-testid="`defer-history-item-${item.id}`"
          class="rounded-md border border-border/60 px-2 py-1"
        >
          <p class="truncate text-xs text-foreground">
            {{ item.eventId }}
          </p>
          <p class="text-[11px] text-muted-foreground">
            {{ formatDueAt(item.dueAt) }}
          </p>
        </li>

        <li v-if="deferStore.historyItems.length === 0" class="px-2 py-2 text-xs text-muted-foreground">
          {{ t('chat.defer_empty_history') }}
        </li>
      </ul>
    </div>
  </section>
</template>
