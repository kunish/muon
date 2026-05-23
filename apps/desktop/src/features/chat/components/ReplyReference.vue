<script setup lang="ts">
import { Avatar } from '@muon/ui/avatar'
import { computed } from 'vue'

const props = defineProps<{
  replySenderName: string
  replyBody: string
  replySender: string
  replySenderMxcAvatar: string | undefined
  isRightAligned: boolean
}>()

const NAME_COLORS = [
  '#b85c4a',
  '#c08b2e',
  '#7a8f52',
  '#4a9882',
  '#6b88a0',
  '#5a7a9a',
  '#8b6fb0',
  '#b06878',
]

const replySenderColor = computed(() => {
  if (!props.replySender)
    return NAME_COLORS[0]
  let hash = 0
  for (const ch of props.replySender) {
    hash = ch.charCodeAt(0) + ((hash << 5) - hash)
  }
  return NAME_COLORS[Math.abs(hash) % NAME_COLORS.length]
})
</script>

<template>
  <div
    class="flex items-center gap-1.5 mb-1 text-[13px] leading-snug cursor-pointer hover:opacity-80"
    :class="isRightAligned ? 'self-end' : ''"
  >
    <div class="w-[2px] h-3 rounded-full bg-muted-foreground/30 shrink-0 ml-0.5" />
    <Avatar
      :src="replySenderMxcAvatar"
      :alt="replySenderName"
      :color-id="replySender"
      size="xs"
      class="shrink-0"
    />
    <span class="font-medium text-[12px] shrink-0" :style="{ color: replySenderColor }">
      {{ replySenderName }}
    </span>
    <span class="text-[12px] text-muted-foreground/60 truncate">
      {{ replyBody }}
    </span>
  </div>
</template>
