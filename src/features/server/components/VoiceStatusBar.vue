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
    class="voice-bar shrink-0 border-t border-border"
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
        class="voice-btn flex-1"
        :class="{ 'voice-btn-active': isMuted }"
        :title="isMuted ? t('voice.unmute') : t('voice.mute')"
        @click="toggleMute"
      >
        <MicOff v-if="isMuted" :size="16" />
        <Mic v-else :size="16" />
      </button>

      <!-- 耳机 -->
      <button
        class="voice-btn flex-1"
        :class="{ 'voice-btn-active': isDeafened }"
        :title="isDeafened ? t('voice.undeafen') : t('voice.deafen')"
        @click="toggleDeafen"
      >
        <HeadphoneOff v-if="isDeafened" :size="16" />
        <Headphones v-else :size="16" />
      </button>

      <!-- 挂断 -->
      <button
        class="voice-btn voice-btn-danger flex-1"
        :title="t('voice.disconnect')"
        @click="disconnect"
      >
        <PhoneOff :size="16" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.voice-bar {
  background: color-mix(in srgb, var(--color-sidebar) 85%, var(--color-background));
}

.voice-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  border-radius: 6px;
  color: var(--color-muted-foreground);
  transition: all 0.12s ease;
  cursor: pointer;
}

.voice-btn:hover {
  background: var(--color-accent);
  color: var(--color-foreground);
}

.voice-btn:active {
  transform: scale(0.95);
}

.voice-btn-active {
  color: var(--color-destructive);
}
.voice-btn-active:hover {
  background: color-mix(in srgb, var(--color-destructive) 12%, transparent);
  color: var(--color-destructive);
}

.voice-btn-danger:hover {
  background: color-mix(in srgb, var(--color-destructive) 12%, transparent);
  color: var(--color-destructive);
}
</style>
