<script setup lang="ts">
import { getClient } from '@matrix/client'
import { Hash, Search, Settings, Users } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { isDirectRoom } from '@/shared/lib/roomUtils'
import { useChatStore } from '../stores/chatStore'

const props = defineProps<{
  roomId: string
}>()

const { t } = useI18n()
const store = useChatStore()

const roomName = computed(() => {
  const room = getClient().getRoom(props.roomId)
  return room?.name || props.roomId
})

const isDirect = computed(() => isDirectRoom(props.roomId))

function openMembers() {
  store.toggleSidePanel('members')
}

function openSettings() {
  store.toggleSidePanel('settings')
}

function openSearch() {
  store.toggleSidePanel('search')
}
</script>

<template>
  <div class="mx-auto mt-10 w-full max-w-[720px] px-6 pb-8">
    <div class="mb-6 text-center">
      <div class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-muted-foreground">
        <Hash v-if="!isDirect" :size="28" />
        <Users v-else :size="26" />
      </div>
      <h2 class="text-4xl font-extrabold tracking-tight text-foreground">
        {{ isDirect ? t('chat.welcome_dm_title') : t('chat.welcome_channel_title', { channel: roomName }) }}
      </h2>
      <p class="mx-auto mt-2 max-w-[580px] text-base text-muted-foreground">
        {{ isDirect ? t('chat.welcome_dm_subtitle') : t('chat.welcome_channel_subtitle', { channel: roomName }) }}
      </p>
    </div>

    <div class="space-y-2">
      <button
        class="flex w-full cursor-pointer items-center gap-3 rounded-[10px] border border-[color-mix(in_srgb,var(--color-border)_65%,transparent)] bg-[color-mix(in_srgb,var(--color-card)_88%,transparent)] px-4 py-3.5 text-left transition-all duration-150 hover:border-[color-mix(in_srgb,var(--color-border)_95%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-card)_100%,var(--color-accent))]"
        @click="openMembers"
      >
        <div class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
          <Users :size="16" />
        </div>
        <div class="text-[22px] font-bold leading-snug text-foreground">
          {{ t('chat.welcome_action_members') }}
        </div>
      </button>

      <button
        class="flex w-full cursor-pointer items-center gap-3 rounded-[10px] border border-[color-mix(in_srgb,var(--color-border)_65%,transparent)] bg-[color-mix(in_srgb,var(--color-card)_88%,transparent)] px-4 py-3.5 text-left transition-all duration-150 hover:border-[color-mix(in_srgb,var(--color-border)_95%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-card)_100%,var(--color-accent))]"
        @click="openSettings"
      >
        <div class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-warning/20 text-warning">
          <Settings :size="16" />
        </div>
        <div class="text-[22px] font-bold leading-snug text-foreground">
          {{ t('chat.welcome_action_settings') }}
        </div>
      </button>

      <button
        class="flex w-full cursor-pointer items-center gap-3 rounded-[10px] border border-[color-mix(in_srgb,var(--color-border)_65%,transparent)] bg-[color-mix(in_srgb,var(--color-card)_88%,transparent)] px-4 py-3.5 text-left transition-all duration-150 hover:border-[color-mix(in_srgb,var(--color-border)_95%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-card)_100%,var(--color-accent))]"
        @click="openSearch"
      >
        <div class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-success/20 text-success">
          <Search :size="16" />
        </div>
        <div class="text-[22px] font-bold leading-snug text-foreground">
          {{ t('chat.welcome_action_search') }}
        </div>
      </button>
    </div>
  </div>
</template>
