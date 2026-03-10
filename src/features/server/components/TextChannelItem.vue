<script setup lang="ts">
import type { ChannelInfo } from '@/matrix/spaces'
import { UserPlus } from 'lucide-vue-next'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useServerStore } from '@/features/server/stores/serverStore'
import { Badge } from '@/shared/components/ui/badge'

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
    <button
      class="group flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors"
      :class="[
        isSelected
          ? 'bg-accent/60 text-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent/30 hover:text-foreground',
        isUnread && !isSelected ? 'font-semibold text-foreground' : '',
      ]"
      @click="navigate"
    >
      <span class="truncate">{{ channel.name }}</span>
      <span v-if="isUnread && !isSelected" class="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-primary shrink-0" />

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
        </div>
      </div>
    </button>
  </div>
</template>
