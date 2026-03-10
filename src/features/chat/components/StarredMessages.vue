<script setup lang="ts">
import type { MatrixEvent } from 'matrix-js-sdk'
import { getClient } from '@matrix/client'
import { Star, X } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  roomId: string
}>()

const emit = defineEmits<{
  close: []
  jumpTo: [eventId: string]
}>()

const { t, locale } = useI18n()

const starred = ref<MatrixEvent[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const client = getClient()
    const room = client.getRoom(props.roomId)
    if (!room)
      return
    const events = room.getLiveTimeline().getEvents()
    starred.value = events.filter((e) => {
      const tags = e.getContent()?.['m.tags'] as Record<string, unknown> | undefined
      return tags?.['m.favourite'] !== undefined
    })
  }
  finally {
    loading.value = false
  }
})

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
      <div class="flex items-center gap-2">
        <Star :size="14" class="text-warning" />
        <span class="text-sm font-medium">{{ t('chat.starred_messages') }}</span>
      </div>
      <button class="p-1 rounded hover:bg-accent" @click="emit('close')">
        <X :size="16" />
      </button>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center text-sm text-muted-foreground">
      {{ t('chat.starred_loading') }}
    </div>

    <div v-else-if="starred.length === 0" class="flex-1 flex items-center justify-center text-sm text-muted-foreground">
      {{ t('chat.starred_empty') }}
    </div>

    <div v-else class="flex-1 overflow-y-auto p-2 space-y-1">
      <div
        v-for="ev in starred"
        :key="ev.getId()"
        class="px-3 py-2 rounded-lg hover:bg-accent/50 cursor-pointer"
        @click="emit('jumpTo', ev.getId()!)"
      >
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-medium">{{ ev.getSender() }}</span>
          <span class="text-xs text-muted-foreground">{{ formatTime(ev.getTs()) }}</span>
        </div>
        <div class="text-sm text-muted-foreground line-clamp-2">
          {{ ev.getContent().body || t('chat.media_message') }}
        </div>
      </div>
    </div>
  </div>
</template>
