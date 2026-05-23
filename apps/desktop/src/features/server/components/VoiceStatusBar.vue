<script setup lang="ts">
import { HeadphoneOff, Headphones, Mic, MicOff, PhoneOff } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVoiceChannel } from '@/features/server/composables/useVoiceChannel'
import { useServerStore } from '@/features/server/stores/serverStore'

const serverStore = useServerStore()
const { t } = useI18n()
const {
  isMuted,
  isDeafened,
  connectedUsers,
  toggleMute,
  toggleDeafen,
  leaveVoiceChannel,
} = useVoiceChannel()

const connection = computed(() => serverStore.voiceConnection)
const isConnected = computed(() => !!connection.value)

const participantCount = computed(() => connectedUsers.value.length)

async function disconnect() {
  await leaveVoiceChannel()
}
</script>

<template>
  <div
    v-if="isConnected"
    class="shrink-0 border-t border-border bg-[color-mix(in_srgb,var(--color-sidebar)_85%,var(--color-background))]"
  >
    <!-- 连接状态信息 -->
    <div class="px-3 pt-2.5 pb-1.5">
      <div class="flex items-center gap-1.5">
        <!-- 绿色脉冲点 -->
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span class="relative inline-flex rounded-full h-2 w-2 bg-success" />
        </span>
        <span class="text-xs font-semibold text-success">
          {{ t('voice.voice_connected') }}
        </span>
      </div>
      <p class="text-[11px] text-muted-foreground/70 mt-0.5 truncate pl-3.5">
        {{ connection!.channelName }}
        <span v-if="participantCount" class="ml-1">· {{ participantCount }}</span>
      </p>
    </div>

    <!-- 控制按钮 -->
    <div class="flex items-center gap-1 px-2 pb-2">
      <!-- 麦克风 -->
      <button
        class="flex h-8 flex-1 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-all duration-[120ms] hover:bg-accent hover:text-foreground active:scale-95"
        :class="isMuted && 'text-destructive hover:bg-[color-mix(in_srgb,var(--color-destructive)_12%,transparent)] hover:text-destructive'"
        :title="isMuted ? t('voice.unmute') : t('voice.mute')"
        @click="toggleMute"
      >
        <MicOff v-if="isMuted" :size="16" />
        <Mic v-else :size="16" />
      </button>

      <!-- 耳机 -->
      <button
        class="flex h-8 flex-1 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-all duration-[120ms] hover:bg-accent hover:text-foreground active:scale-95"
        :class="isDeafened && 'text-destructive hover:bg-[color-mix(in_srgb,var(--color-destructive)_12%,transparent)] hover:text-destructive'"
        :title="isDeafened ? t('voice.undeafen') : t('voice.deafen')"
        @click="toggleDeafen"
      >
        <HeadphoneOff v-if="isDeafened" :size="16" />
        <Headphones v-else :size="16" />
      </button>

      <!-- 挂断 -->
      <button
        class="flex h-8 flex-1 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-all duration-[120ms] hover:bg-[color-mix(in_srgb,var(--color-destructive)_12%,transparent)] hover:text-destructive active:scale-95"
        :title="t('voice.disconnect')"
        @click="disconnect"
      >
        <PhoneOff :size="16" />
      </button>
    </div>
  </div>
</template>
