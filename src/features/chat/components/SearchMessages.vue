<script setup lang="ts">
import { getClient } from '@matrix/client'
import { Search, X } from 'lucide-vue-next'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  roomId: string
}>()

const emit = defineEmits<{
  close: []
  jumpTo: [eventId: string]
}>()

const { t, locale } = useI18n()

const query = ref('')
const results = ref<Array<{ eventId: string, sender: string, body: string, ts: number }>>([])
const searching = ref(false)

async function handleSearch() {
  const q = query.value.trim()
  if (!q)
    return
  searching.value = true
  results.value = []
  try {
    const client = getClient()
    const res = await client.searchRoomEvents({ term: q, filter: { rooms: [props.roomId] } } as any)
    results.value = (res.results || []).map((r: any) => ({
      eventId: r.result.event_id,
      sender: r.result.sender,
      body: r.result.content?.body || '',
      ts: r.result.origin_server_ts,
    }))
  }
  catch {
    results.value = []
  }
  finally {
    searching.value = false
  }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(locale.value, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex items-center justify-between p-3 border-b border-border">
      <span class="text-sm font-medium">{{ t('chat.search_messages') }}</span>
      <button class="p-1 rounded hover:bg-accent" @click="emit('close')">
        <X :size="16" />
      </button>
    </div>

    <div class="p-3">
      <form class="flex items-center gap-2" @submit.prevent="handleSearch">
        <div class="flex-1 min-w-0 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
          <Search :size="14" class="shrink-0 text-muted-foreground" />
          <input
            v-model="query"
            type="text"
            :placeholder="t('chat.search_keyword')"
            class="flex-1 min-w-0 bg-transparent text-sm outline-none"
          >
        </div>
        <button
          type="submit"
          class="shrink-0 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
          :disabled="!query.trim() || searching"
        >
          {{ t('chat.search_btn') }}
        </button>
      </form>
    </div>

    <div v-if="searching" class="flex-1 flex items-center justify-center text-sm text-muted-foreground">
      {{ t('chat.searching') }}
    </div>

    <div v-else-if="results.length === 0 && query.trim()" class="flex-1 flex items-center justify-center text-sm text-muted-foreground">
      {{ t('chat.search_no_result') }}
    </div>

    <div v-else class="flex-1 overflow-y-auto p-2 space-y-1">
      <div
        v-for="item in results"
        :key="item.eventId"
        class="px-3 py-2 rounded-lg hover:bg-accent/50 cursor-pointer"
        @click="emit('jumpTo', item.eventId)"
      >
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-medium">{{ item.sender }}</span>
          <span class="text-xs text-muted-foreground">{{ formatTime(item.ts) }}</span>
        </div>
        <div class="text-sm text-muted-foreground line-clamp-2">
          {{ item.body }}
        </div>
      </div>
    </div>
  </div>
</template>
