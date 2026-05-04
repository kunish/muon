<script setup lang="ts">
import type { DigestFilter } from '../types/digest'
import type { DigestRelevance } from '../types/knowledge'
import { computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { preloadAndNavigate } from '@/shared/lib/contextPreload'
import { useDigestStore } from '../stores/digestStore'

const router = useRouter()
const digestStore = useDigestStore()
const { t } = useI18n()

const filters = computed<Array<{ id: DigestFilter, label: string }>>(() => [
  { id: 'all', label: t('chat.digest_filter_all') },
  { id: 'responsibility', label: t('chat.digest_relevance_responsibility') },
  { id: 'follow', label: t('chat.digest_relevance_follow') },
  { id: 'mention', label: t('chat.digest_relevance_mention') },
])

const entries = computed(() => digestStore.visibleEntries)

function relevanceLabel(relevance: DigestRelevance) {
  return t(`chat.digest_relevance_${relevance}`)
}

onMounted(() => {
  void digestStore.initializeDigest()
})

onUnmounted(() => {
  digestStore.stopRuntimeSync()
})

async function openCitation(roomId: string, eventId: string) {
  await preloadAndNavigate(router, roomId, eventId, 'OfflineDigestPanel')
}
</script>

<template>
  <section class="flex h-full flex-col" data-testid="offline-digest-panel">
    <header class="border-b border-border px-4 py-3">
      <div class="text-sm font-semibold text-foreground">
        {{ t('chat.offline_digest_title') }}
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
          {{ relevanceLabel(entry.relevance) }}
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
            {{ t('chat.knowledge_open_citation') }}
          </button>
        </div>
      </article>

      <p v-if="entries.length === 0" class="text-sm text-muted-foreground">
        {{ t('chat.digest_empty') }}
      </p>
    </div>
  </section>
</template>
