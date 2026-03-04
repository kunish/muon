<script setup lang="ts">
import type { ChannelInfo } from '@/matrix/spaces'
import {
  BellOff,
  CheckCheck,
  Copy,
  Pencil,
  Trash2,
} from 'lucide-vue-next'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from 'radix-vue'
import { computed } from 'vue'
import { useServerStore } from '@/features/server/stores/serverStore'
import { getClient } from '@/matrix/client'

const props = defineProps<{
  channel: ChannelInfo
}>()

const emit = defineEmits<{
  markAsRead: [roomId: string]
  muteChannel: [roomId: string]
  editChannel: [roomId: string]
  deleteChannel: [roomId: string]
  copyLink: [roomId: string]
}>()

const serverStore = useServerStore()

const isAdmin = computed(() => {
  const serverId = serverStore.currentServerId
  if (!serverId)
    return false
  const client = getClient()
  const room = client.getRoom(serverId)
  if (!room)
    return false
  const userId = client.getUserId()
  if (!userId)
    return false
  const plEvent = room.currentState.getStateEvents('m.room.power_levels', '')
  const content = plEvent?.getContent() || {}
  const userLevel = (content.users as Record<string, number>)?.[userId] ?? (content.users_default ?? 0)
  return userLevel >= 50
})

function handleCopyLink() {
  const link = `${window.location.origin}/server/${encodeURIComponent(serverStore.currentServerId!)}/channel/${encodeURIComponent(props.channel.roomId)}`
  navigator.clipboard.writeText(link)
  emit('copyLink', props.channel.roomId)
}
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent
        class="z-50 min-w-48 overflow-hidden rounded-md border border-border bg-popover p-1.5 text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95"
      >
        <ContextMenuItem
          class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
          @select="emit('markAsRead', channel.roomId)"
        >
          <CheckCheck :size="16" />
          Mark as Read
        </ContextMenuItem>

        <ContextMenuItem
          class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
          @select="emit('muteChannel', channel.roomId)"
        >
          <BellOff :size="16" />
          Mute Channel
        </ContextMenuItem>

        <ContextMenuSeparator class="mx-1 my-1 h-px bg-border" />

        <!-- Admin-only actions -->
        <ContextMenuItem
          v-if="isAdmin"
          class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
          @select="emit('editChannel', channel.roomId)"
        >
          <Pencil :size="16" />
          Edit Channel
        </ContextMenuItem>

        <ContextMenuItem
          v-if="isAdmin"
          class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none transition-colors hover:bg-destructive hover:text-destructive-foreground focus:bg-destructive focus:text-destructive-foreground"
          @select="emit('deleteChannel', channel.roomId)"
        >
          <Trash2 :size="16" />
          Delete Channel
        </ContextMenuItem>

        <ContextMenuSeparator v-if="isAdmin" class="mx-1 my-1 h-px bg-border" />

        <ContextMenuItem
          class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
          @select="handleCopyLink"
        >
          <Copy :size="16" />
          Copy Link
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
