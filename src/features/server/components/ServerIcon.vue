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
  return `hsl(${hue}, 70%, 50%)`
})

// Unread info
const unreadInfo = computed(() => serverStore.getServerUnreadInfo(props.spaceId))
const hasUnread = computed(() => unreadInfo.value.unreadCount > 0)
const hasHighlight = computed(() => unreadInfo.value.highlightCount > 0)
</script>

<template>
  <div class="relative">
    <div
      class="server-icon transition-all duration-150"
      :class="isSelected ? 'rounded-2xl' : 'rounded-3xl hover:rounded-2xl'"
    >
      <img
        v-if="avatarSrc"
        :src="avatarSrc"
        :alt="name"
        class="w-full h-full object-cover"
      >
      <span
        v-else
        class="text-white text-lg font-semibold"
        :style="{ backgroundColor: bgColor }"
      >
        {{ initial }}
      </span>
    </div>

    <!-- Unread dot -->
    <div
      v-if="hasUnread && !isSelected && !hasHighlight"
      class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-foreground rounded-full"
    />

    <!-- Mention badge -->
    <div
      v-if="hasHighlight"
      class="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-[11px] font-bold rounded-full flex items-center justify-center px-1"
    >
      {{ unreadInfo.highlightCount > 99 ? '99+' : unreadInfo.highlightCount }}
    </div>
  </div>
</template>

<style scoped>
.server-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: hsl(223 7% 21%);
}

.server-icon span {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
