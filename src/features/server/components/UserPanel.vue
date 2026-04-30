<script setup lang="ts">
import { getClient } from '@matrix/client'
import { getMyAvatarUrl, getMyDisplayName } from '@matrix/index'
import { Headphones, Mic, MicOff, Settings } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useVoiceChannel } from '@/features/server/composables/useVoiceChannel'
import { Avatar } from '@/shared/components/ui/avatar'

const router = useRouter()
const { t } = useI18n()

const currentUser = computed(() => {
  const client = getClient()
  const userId = client.getUserId()
  return {
    displayName: getMyDisplayName(),
    mxcAvatar: getMyAvatarUrl(),
    userId: userId || '',
  }
})

const {
  isMuted,
  isDeafened,
  toggleMute,
  toggleDeafen,
} = useVoiceChannel()

const actionButtonClass = 'flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-all duration-150 hover:bg-sidebar-accent hover:text-foreground active:scale-95'

function openSettings(): void {
  router.push('/settings')
}
</script>

<template>
  <div class="user-panel flex shrink-0 items-center gap-2 border-t border-sidebar-border/80 bg-sidebar/90 px-3 py-2.5 backdrop-blur-xl">
    <div class="flex min-w-0 flex-1 items-center gap-2">
      <Avatar
        :src="currentUser.mxcAvatar"
        :alt="currentUser.displayName"
        :color-id="currentUser.userId"
        size="sm"
      />
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-semibold leading-tight text-foreground">
          {{ currentUser.displayName }}
        </div>
        <div class="truncate text-[11px] leading-tight text-muted-foreground">
          {{ currentUser.userId }}
        </div>
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-0.5">
      <button
        :class="[
          actionButtonClass,
          isMuted ? 'text-destructive hover:bg-[color-mix(in_srgb,var(--color-destructive)_12%,transparent)] hover:text-destructive' : '',
        ]"
        :title="isMuted ? t('voice.unmute') : t('voice.mute')"
        @click="toggleMute"
      >
        <MicOff v-if="isMuted" :size="16" />
        <Mic v-else :size="16" />
      </button>
      <button
        :class="[
          actionButtonClass,
          isDeafened ? 'text-destructive hover:bg-[color-mix(in_srgb,var(--color-destructive)_12%,transparent)] hover:text-destructive' : '',
        ]"
        :title="isDeafened ? t('voice.undeafen') : t('voice.deafen')"
        @click="toggleDeafen"
      >
        <Headphones :size="16" />
      </button>
      <button
        :class="actionButtonClass"
        :title="t('settings.settings')"
        @click="openSettings"
      >
        <Settings :size="16" />
      </button>
    </div>
  </div>
</template>
