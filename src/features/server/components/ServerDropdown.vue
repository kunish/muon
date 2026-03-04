<script setup lang="ts">
import {
  Bell,
  FolderPlus,
  Hash,
  LogOut,
  Settings,
  UserPlus,
} from 'lucide-vue-next'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'radix-vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useServerStore } from '@/features/server/stores/serverStore'
import { getClient } from '@/matrix/client'

const emit = defineEmits<{
  createChannel: []
  createCategory: []
  invitePeople: []
  serverSettings: []
  notificationSettings: []
  leaveServer: []
}>()

const serverStore = useServerStore()
const open = ref(false)
const { t } = useI18n()

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
</script>

<template>
  <DropdownMenuRoot v-model:open="open">
    <DropdownMenuTrigger as-child>
      <slot name="trigger" :open="open" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        class="z-50 min-w-56 overflow-hidden rounded-md bg-popover p-1.5 text-popover-foreground shadow-[0_8px_24px_rgba(0,0,0,0.5)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        :side-offset="6"
        align="start"
      >
        <!-- Server Settings (admin only) -->
        <DropdownMenuItem
          v-if="isAdmin"
          class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary outline-none transition-colors hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground"
          @select="emit('serverSettings')"
        >
          <Settings :size="16" />
          {{ t('server.server_settings') }}
        </DropdownMenuItem>

        <DropdownMenuSeparator v-if="isAdmin" class="mx-1 my-1 h-px bg-border" />

        <DropdownMenuItem
          class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground"
          @select="emit('createChannel')"
        >
          <Hash :size="16" />
          {{ t('channel.create_channel') }}
        </DropdownMenuItem>

        <DropdownMenuItem
          class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground"
          @select="emit('createCategory')"
        >
          <FolderPlus :size="16" />
          {{ t('channel.create_category') }}
        </DropdownMenuItem>

        <DropdownMenuSeparator class="mx-1 my-1 h-px bg-border" />

        <DropdownMenuItem
          class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground"
          @select="emit('invitePeople')"
        >
          <UserPlus :size="16" />
          {{ t('server.invite_people') }}
        </DropdownMenuItem>

        <DropdownMenuItem
          class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground"
          @select="emit('notificationSettings')"
        >
          <Bell :size="16" />
          {{ t('server.notification_settings') }}
        </DropdownMenuItem>

        <DropdownMenuSeparator class="mx-1 my-1 h-px bg-border" />

        <DropdownMenuItem
          class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none transition-colors hover:bg-destructive hover:text-destructive-foreground focus:bg-destructive focus:text-destructive-foreground"
          @select="emit('leaveServer')"
        >
          <LogOut :size="16" />
          {{ t('server.leave_server') }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
