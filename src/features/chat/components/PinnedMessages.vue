<script setup lang="ts">
import type { MatrixEvent } from 'matrix-js-sdk'
import { getClient } from '@matrix/client'
import { Pin, X } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'

const props = defineProps<{
  roomId: string
}>()

const emit = defineEmits<{
  close: []
  jumpTo: [eventId: string]
}>()

const pinned = ref<MatrixEvent[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const client = getClient()
    const room = client.getRoom(props.roomId)
    if (!room)
      return
    const pinEvent = room.currentState.getStateEvents('m.room.pinned_events', '')
    const pinnedIds: string[] = pinEvent?.getContent()?.pinned || []
    const events: MatrixEvent[] = []
    for (const id of pinnedIds) {
      const ev = room.findEventById(id)
      if (ev)
        events.push(ev)
    }
    pinned.value = events
  }
  finally {
    loading.value = false
  }
})

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
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
        <Pin :size="14" class="text-primary" />
        <span class="text-sm font-medium">置顶消息</span>
      </div>
      <button class="p-1 rounded hover:bg-accent" @click="emit('close')">
        <X :size="16" />
      </button>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center text-sm text-muted-foreground">
      加载中...
    </div>

    <div v-else-if="pinned.length === 0" class="flex-1 flex items-center justify-center text-sm text-muted-foreground">
      暂无置顶消息
    </div>

    <div v-else class="flex-1 overflow-y-auto p-2 space-y-1">
      <div
        v-for="ev in pinned"
        :key="ev.getId()"
        class="px-3 py-2 rounded-lg hover:bg-accent/50 cursor-pointer"
        @click="emit('jumpTo', ev.getId()!)"
      >
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-medium">{{ ev.getSender() }}</span>
          <span class="text-xs text-muted-foreground">{{ formatTime(ev.getTs()) }}</span>
        </div>
        <div class="text-sm text-muted-foreground line-clamp-2">
          {{ ev.getContent().body || '[媒体消息]' }}
        </div>
      </div>
    </div>
  </div>
</template>
