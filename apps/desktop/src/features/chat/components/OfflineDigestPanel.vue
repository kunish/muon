<script setup lang="ts">
import type { DigestFilter } from '../types/digest';
import type { DigestRelevance } from '../types/knowledge';
import { useSelector } from '@tanstack/vue-store';
import { computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useNetworkStatus } from '@/shared/composables/useNetworkStatus';
import { preloadAndNavigate } from '@/shared/lib/contextPreload';
import { selectVisibleDigestEntries } from '../queries/digestApi';
import { useBuildDigestSession, useDigestEntriesQuery } from '../queries/useDigest';
import { digestStore, setFilter, startRuntimeSync, stopRuntimeSync } from '../stores/digestStore';

const router = useRouter();
const { t } = useI18n();
const { lastOfflineAt } = useNetworkStatus();

const digestEntriesQuery = useDigestEntriesQuery();
const buildSession = useBuildDigestSession();
const activeFilter = useSelector(digestStore, (state) => state.activeFilter);

const filters = computed<Array<{ id: DigestFilter; label: string }>>(() => [
  { id: 'all', label: t('chat.digest_filter_all') },
  { id: 'responsibility', label: t('chat.digest_relevance_responsibility') },
  { id: 'follow', label: t('chat.digest_relevance_follow') },
  { id: 'mention', label: t('chat.digest_relevance_mention') },
]);

const entries = computed(() => selectVisibleDigestEntries(digestEntriesQuery.entries.value, activeFilter.value));

function relevanceLabel(relevance: DigestRelevance) {
  return t(`chat.digest_relevance_${relevance}`);
}

onMounted(async () => {
  startRuntimeSync();
  // Best-effort background init: hydrate persisted entries first, then (only if we
  // were offline) refresh the away-window session. Ordering matters so the build's
  // setQueryData lands on top of the hydrated cache instead of racing it. A failure
  // must not break the panel — hydrated entries still render — but is logged, never
  // silently swallowed.
  const hydrated = await digestEntriesQuery.refetch();
  if (hydrated.isError) {
    console.error('[OfflineDigestPanel] failed to hydrate digest entries', hydrated.error);
    return;
  }
  const windowStart = lastOfflineAt.value;
  if (windowStart == null) return;
  try {
    await buildSession.mutateAsync({
      sourceEvents: digestStore.state.sourceEvents,
      windowStart,
      windowEnd: Date.now(),
    });
  } catch (err) {
    console.error('[OfflineDigestPanel] failed to build offline digest session', err);
  }
});

onUnmounted(() => {
  stopRuntimeSync();
});

async function openCitation(roomId: string, eventId: string) {
  await preloadAndNavigate(router, roomId, eventId, 'OfflineDigestPanel');
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
          :class="activeFilter === filter.id ? 'border-primary text-primary' : 'border-border text-muted-foreground'"
          :data-testid="`digest-filter-${filter.id}`"
          @click="setFilter(filter.id)"
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
