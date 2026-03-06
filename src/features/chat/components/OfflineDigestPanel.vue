<script setup lang="ts">
import { loadInboxEventContext } from '@matrix/index'
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDigestStore } from '../stores/digestStore'
import type { DigestFilter } from '../types/digest'

const router = useRouter()
const digestStore = useDigestStore()

const filters: Array<{ id: DigestFilter, label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'responsibility', label: 'Responsibility' },
  { id: 'follow', label: 'Follow' },
  { id: 'mention', label: 'Mention' },
]

const entries = computed(() => digestStore.visibleEntries)

onMounted(() => {
  void digestStore.initializeDigest()
})

onUnmounted(() => {
  digestStore.stopRuntimeSync()
})

async function openCitation(roomId: string, eventId: string) {
  try {
    await loadInboxEventContext(roomId, eventId)
  }
  catch (error) {
    console.warn('[OfflineDigestPanel] context preload failed, fallback to direct navigation', error)
  }

  await router.push({
    path: `/dm/${encodeURIComponent(roomId)}`,
    query: {
      focusEventId: eventId,
    },
  })
}
</script>

<template>
  <section class="flex h-full flex-col" data-testid="offline-digest-panel">
    <header class="border-b border-border px-4 py-3">
      <div class="text-sm font-semibold text-foreground">
        Offline Digest
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          v-for="filter in filters"
          :key="filter.id"
          type="button"
          class="rounded-md border px-2 py-1 text-xs"
          :class="digestStore.activeFilter === filter.id ? 'border-primary text-primary' : 'border-border text-muted-foreground'"
          :data-testid="`digest-filter-${filter.id}`"
          @click="digestStore.setFilter(filter.id)"
        >
          {{ filter.label }}
        </button>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-3">
      <article
        v-for="entry in entries"
        :key="entry.id"
        class="rounded-md border border-border/70 p-3"
        :data-testid="`digest-entry-${entry.eventId}`"
      >
        <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {{ entry.relevance }}
        </div>
        <div class="mt-1 text-sm font-medium text-foreground">
          {{ entry.title }}
        </div>
        <p class="mt-2 text-sm text-muted-foreground">
          {{ entry.summary }}
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            v-for="citation in entry.citations"
            :key="citation.eventId"
            type="button"
            class="rounded border border-border px-2 py-1 text-xs"
            :data-testid="`digest-citation-${citation.eventId}`"
            @click="openCitation(citation.roomId, citation.eventId)"
          >
            Open citation
          </button>
        </div>
      </article>

      <p v-if="entries.length === 0" class="text-sm text-muted-foreground">
        No digest entries yet.
      </p>
    </div>
  </section>
</template>
