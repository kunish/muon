<script setup lang="ts">
import { computed, ref } from 'vue'
import { useServerStore } from '@/features/server/stores/serverStore'
import { useAuthMedia } from '@/shared/composables/useAuthMedia'

const props = defineProps<{
  name: string
  avatar?: string
  isSelected: boolean
  spaceId: string
}>()

const serverStore = useServerStore()

// Avatar loading
const avatarSrc = props.avatar ? useAuthMedia(() => props.avatar!) : ref<string | undefined>(undefined)

// First letter fallback
const initial = computed(() => {
  return props.name.charAt(0).toUpperCase()
})

// Deterministic color from spaceId hash
const bgColor = computed(() => {
  let hash = 0
  for (let i = 0; i < props.spaceId.length; i++) {
    hash = props.spaceId.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `oklch(65% 0.15 ${hue})`
})

// Unread info
const unreadInfo = computed(() => serverStore.getServerUnreadInfo(props.spaceId))
const hasUnread = computed(() => unreadInfo.value.unreadCount > 0)
const hasHighlight = computed(() => unreadInfo.value.highlightCount > 0)
</script>

<template>
  <div class="relative">
    <div
      class="flex size-9 items-center justify-center overflow-hidden bg-muted transition-all duration-150"
      :class="isSelected ? 'rounded-xl' : 'rounded-xl hover:rounded-lg'"
    >
      <img
        v-if="avatarSrc"
        :src="avatarSrc"
        :alt="name"
        class="w-full h-full object-cover"
      >
      <span
        v-else
        class="flex size-full items-center justify-center text-sm font-semibold text-white"
        :style="{ backgroundColor: bgColor }"
      >
        {{ initial }}
      </span>
    </div>

    <!-- Unread dot -->
    <div
      v-if="hasUnread && !isSelected && !hasHighlight"
      class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-foreground rounded-full"
    />

    <!-- Mention badge -->
    <div
      v-if="hasHighlight"
      class="absolute -bottom-1 -right-1 min-w-[16px] h-[16px] bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1"
    >
      {{ unreadInfo.highlightCount > 99 ? '99+' : unreadInfo.highlightCount }}
    </div>
  </div>
</template>
