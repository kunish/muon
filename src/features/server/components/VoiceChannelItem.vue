<script setup lang="ts">
import type { ChannelInfo } from '@/matrix/spaces'
import { MicOff, Volume2 } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVoiceChannel } from '@/features/server/composables/useVoiceChannel'
import { useServerStore } from '@/features/server/stores/serverStore'
import Avatar from '@/shared/components/ui/avatar.vue'

const props = defineProps<{
  channel: ChannelInfo
  /** Users currently connected to this voice channel */
  connectedUsers?: { userId: string, displayName: string, avatarUrl?: string, isMuted?: boolean }[]
}>()

const serverStore = useServerStore()
const { t } = useI18n()
const {
  currentChannelId,
  isConnected,
  isConnecting,
  connectedUsers: voiceUsers,
  joinVoiceChannel,
  switchVoiceChannel,
} = useVoiceChannel()

const isActive = computed(() =>
  currentChannelId.value === props.channel.roomId && isConnected.value,
)

const isUnread = computed(() => props.channel.unreadCount > 0)
const hasMentions = computed(() => props.channel.highlightCount > 0)

const isJoining = computed(() =>
  currentChannelId.value === props.channel.roomId && isConnecting.value,
)

const usersInChannel = computed(() => {
  if (isActive.value)
    return voiceUsers.value
  return props.connectedUsers ?? []
})

const memberCount = computed(() => usersInChannel.value.length)

async function onJoinVoice() {
  const serverId = serverStore.currentServerId
  if (!serverId || isActive.value || isJoining.value)
    return

  if (isConnected.value) {
    await switchVoiceChannel(props.channel.roomId, props.channel.name, serverId)
    return
  }

  await joinVoiceChannel(props.channel.roomId, props.channel.name, serverId)
}
</script>

<template>
  <div class="relative">
    <div
      v-if="isUnread && !isActive"
      class="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-2 rounded-r-full bg-foreground"
    />

    <!-- Voice channel row -->
    <button
      class="group flex w-full items-center gap-1.5 rounded px-2 py-[5px] text-[15px] transition-colors"
      :class="[
        isActive
          ? 'bg-accent text-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent/30 hover:text-foreground',
        isUnread && !isActive ? 'font-semibold text-foreground' : '',
      ]"
      @click="onJoinVoice"
    >
      <Volume2
        :size="20"
        class="shrink-0 opacity-70"
        :class="isActive ? 'text-foreground' : 'text-muted-foreground'"
      />
      <span class="truncate">{{ channel.name }}</span>
      <span v-if="isJoining" class="ml-auto text-[11px] text-muted-foreground">{{ t('calls.connecting') }}</span>
      <span v-else-if="hasMentions" class="ml-auto inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">
        {{ channel.highlightCount > 99 ? '99+' : channel.highlightCount }}
      </span>
      <span v-else-if="memberCount > 0" class="ml-auto text-[11px] text-muted-foreground/70">{{ memberCount }}</span>
    </button>

    <!-- Connected users list -->
    <div v-if="usersInChannel.length" class="ml-7 space-y-0.5 pb-1">
      <div
        v-for="user in usersInChannel"
        :key="user.userId"
        class="flex items-center gap-1.5 rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <Avatar
          :src="user.avatarUrl"
          :alt="user.displayName"
          :color-id="user.userId"
          size="sm"
          class="!h-6 !w-6"
        />
        <span class="truncate">{{ user.displayName }}</span>
        <MicOff v-if="user.isMuted" :size="12" class="ml-auto shrink-0 text-destructive" />
      </div>
    </div>
  </div>
</template>
