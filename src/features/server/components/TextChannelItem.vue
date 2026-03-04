<script setup lang="ts">
import type { ChannelInfo } from '@/matrix/spaces'
import { Hash, Settings, UserPlus } from 'lucide-vue-next'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useServerStore } from '@/features/server/stores/serverStore'
import Badge from '@/shared/components/ui/badge.vue'

const props = defineProps<{
  channel: ChannelInfo
}>()

const router = useRouter()
const serverStore = useServerStore()

const isSelected = computed(() => serverStore.currentChannelId === props.channel.roomId)
const isUnread = computed(() => props.channel.unreadCount > 0)
const hasMentions = computed(() => props.channel.highlightCount > 0)

function navigate() {
  serverStore.selectChannel(props.channel.roomId)
  const serverId = serverStore.currentServerId
  if (serverId) {
    router.push(`/server/${encodeURIComponent(serverId)}/channel/${encodeURIComponent(props.channel.roomId)}`)
  }
}
</script>

<template>
  <div class="relative">
    <!-- Unread pill indicator (left edge) -->
    <div
      v-if="isUnread && !isSelected"
      class="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-2 rounded-r-full bg-foreground"
    />

    <button
      class="group flex w-full items-center gap-1.5 rounded px-2 py-[5px] text-[15px] transition-colors"
      :class="[
        isSelected
          ? 'bg-accent text-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent/30 hover:text-foreground',
        isUnread && !isSelected ? 'font-semibold text-foreground' : '',
      ]"
      @click="navigate"
    >
      <Hash
        :size="20"
        class="shrink-0 opacity-70"
        :class="isSelected || isUnread ? 'text-foreground' : 'text-muted-foreground'"
      />
      <span class="truncate">{{ channel.name }}</span>

      <!-- Right actions / mention -->
      <div class="ml-auto flex items-center">
        <Badge
          v-if="hasMentions"
          variant="destructive"
          class="h-4 min-w-4 px-1 text-[10px] leading-none"
        >
          {{ channel.highlightCount > 99 ? '99+' : channel.highlightCount }}
        </Badge>

        <div v-else class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <UserPlus :size="14" class="text-muted-foreground hover:text-foreground" />
          <Settings :size="14" class="text-muted-foreground hover:text-foreground" />
        </div>
      </div>
    </button>
  </div>
</template>
