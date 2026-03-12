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
        class="welcome-card"
        @click="openMembers"
      >
        <div class="welcome-card-icon bg-primary/20 text-primary">
          <Users :size="16" />
        </div>
        <div class="welcome-card-text">
          {{ t('chat.welcome_action_members') }}
        </div>
      </button>

      <button
        class="welcome-card"
        @click="openSettings"
      >
        <div class="welcome-card-icon bg-warning/20 text-warning">
          <Settings :size="16" />
        </div>
        <div class="welcome-card-text">
          {{ t('chat.welcome_action_settings') }}
        </div>
      </button>

      <button
        class="welcome-card"
        @click="openSearch"
      >
        <div class="welcome-card-icon bg-success/20 text-success">
          <Search :size="16" />
        </div>
        <div class="welcome-card-text">
          {{ t('chat.welcome_action_search') }}
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.welcome-card {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--color-border) 65%, transparent);
  background: color-mix(in srgb, var(--color-card) 88%, transparent);
  padding: 14px 16px;
  text-align: left;
  transition: all 0.15s ease;
  cursor: pointer;
}

.welcome-card:hover {
  border-color: color-mix(in srgb, var(--color-border) 95%, transparent);
  background: color-mix(in srgb, var(--color-card) 100%, var(--color-accent));
}

.welcome-card-icon {
  display: inline-flex;
  height: 28px;
  width: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  flex-shrink: 0;
}

.welcome-card-text {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.25;
  color: var(--color-foreground);
}
</style>
