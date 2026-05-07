<script setup lang="ts">
import type { ChannelInfo } from '@/matrix/spaces'
import { Badge } from '@muon/ui/badge'
import { UserPlus } from 'lucide-vue-next'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useServerStore } from '@/features/server/stores/serverStore'

const props = defineProps<{
  channel: ChannelInfo
  contextMenuOpen?: boolean
}>()

const router = useRouter()
const serverStore = useServerStore()

const isSelected = computed(() => serverStore.currentChannelId === props.channel.roomId)
const isUnread = computed(() => props.channel.unreadCount > 0)
const hasMentions = computed(() => props.channel.highlightCount > 0)
const rowStateClass = computed(() => {
  if (isSelected.value)
    return 'workspace-row-active font-medium'
  if (props.contextMenuOpen === true)
    return 'bg-sidebar-accent text-foreground'
  return 'hover:bg-sidebar-accent hover:text-foreground'
})
const hoverAffordanceClass = computed(() =>
  props.contextMenuOpen === true ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
)
const badgeStyle = 'solid' as const

function navigate(): void {
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
      class="workspace-row group gap-2 px-3 py-2 text-muted-foreground"
      :class="[
        rowStateClass,
        isUnread && !isSelected ? 'font-semibold text-foreground' : '',
      ]"
      @click="navigate"
    >
      <span class="truncate">{{ channel.name }}</span>
      <span v-if="isUnread && !isSelected" class="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-primary shrink-0" />

      <div class="ml-auto flex items-center">
        <Badge
          v-if="hasMentions"
          tone="danger"
          :style="badgeStyle"
          class="h-4 min-w-4 px-1 text-[10px] leading-none"
        >
          {{ channel.highlightCount > 99 ? '99+' : channel.highlightCount }}
        </Badge>

        <div v-else class="flex items-center gap-0.5 transition-opacity" :class="hoverAffordanceClass">
          <UserPlus :size="14" class="text-muted-foreground hover:text-foreground" />
        </div>
      </div>
    </button>
  </div>
</template>
