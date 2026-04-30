<script setup lang="ts">
import type { ChannelInfo } from '@/matrix/spaces'
import {
  BellOff,
  CheckCheck,
  Copy,
  Pencil,
  Trash2,
} from 'lucide-vue-next'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useServerStore } from '@/features/server/stores/serverStore'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/shared/components/ui/context-menu'
import { useRoomPermissions } from '@/shared/composables/useRoomPermissions'

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

const { t } = useI18n()
const serverStore = useServerStore()
const open = shallowRef(false)

defineSlots<{
  default?: (props: { open: boolean }) => unknown
}>()

const { isModerator: isAdmin } = useRoomPermissions(computed(() => serverStore.currentServerId))

function handleCopyLink() {
  const link = `${window.location.origin}/server/${encodeURIComponent(serverStore.currentServerId!)}/channel/${encodeURIComponent(props.channel.roomId)}`
  navigator.clipboard.writeText(link)
  emit('copyLink', props.channel.roomId)
}
</script>

<template>
  <ContextMenu v-model:open="open">
    <ContextMenuTrigger as-child>
      <slot :open="open" />
    </ContextMenuTrigger>
    <ContextMenuContent
      class="min-w-48 p-1.5 shadow-xl"
    >
      <ContextMenuItem
        class="cursor-pointer"
        @select="emit('markAsRead', channel.roomId)"
      >
        <CheckCheck :size="16" />
        {{ t('channel.mark_as_read') }}
      </ContextMenuItem>

      <ContextMenuItem
        class="cursor-pointer"
        @select="emit('muteChannel', channel.roomId)"
      >
        <BellOff :size="16" />
        {{ t('channel.mute_channel') }}
      </ContextMenuItem>

      <ContextMenuSeparator class="mx-1 my-1 h-px bg-border" />

      <!-- Admin-only actions -->
      <ContextMenuItem
        v-if="isAdmin"
        class="cursor-pointer"
        @select="emit('editChannel', channel.roomId)"
      >
        <Pencil :size="16" />
        {{ t('channel.edit_channel') }}
      </ContextMenuItem>

      <ContextMenuItem
        v-if="isAdmin"
        class="workspace-menu-item-destructive cursor-pointer"
        @select="emit('deleteChannel', channel.roomId)"
      >
        <Trash2 :size="16" />
        {{ t('channel.delete_channel') }}
      </ContextMenuItem>

      <ContextMenuSeparator v-if="isAdmin" class="mx-1 my-1 h-px bg-border" />

      <ContextMenuItem
        class="cursor-pointer"
        @select="handleCopyLink"
      >
        <Copy :size="16" />
        {{ t('channel.copy_link') }}
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>
