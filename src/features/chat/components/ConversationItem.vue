<script setup lang="ts">
import type { RoomSummary } from '@matrix/types'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed } from 'vue'

const props = defineProps<{
  room: RoomSummary
  active: boolean
}>()

defineEmits<{
  select: [roomId: string]
}>()

const timeLabel = computed(() => {
  if (!props.room.lastMessageTs)
    return ''
  return formatDistanceToNow(props.room.lastMessageTs, { addSuffix: false, locale: zhCN })
})

const initials = computed(() => {
  return props.room.name.slice(0, 1).toUpperCase()
})
</script>

<template>
  <div
    class="flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg transition-colors"
    :class="active ? 'bg-accent' : 'hover:bg-accent/50'"
    @click="$emit('select', room.roomId)"
  >
    <div class="relative shrink-0">
      <img
        v-if="room.avatar"
        :src="room.avatar"
        :alt="room.name"
        class="w-10 h-10 rounded-full object-cover"
      >
      <div
        v-else
        class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium"
      >
        {{ initials }}
      </div>
    </div>

    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium truncate">{{ room.name }}</span>
        <span class="text-[10px] text-muted-foreground shrink-0 ml-2">{{ timeLabel }}</span>
      </div>
      <div class="flex items-center justify-between mt-0.5">
        <span class="text-xs text-muted-foreground truncate">{{ room.lastMessage || '暂无消息' }}</span>
        <span
          v-if="room.unreadCount > 0"
          class="shrink-0 ml-2 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center px-1"
        >
          {{ room.unreadCount > 99 ? '99+' : room.unreadCount }}
        </span>
      </div>
    </div>
  </div>
</template>
