<script setup lang="ts">
import { getUserPresenceInfo } from '@matrix/index'
import { formatDistanceToNow } from 'date-fns'
import { enUS, zhCN } from 'date-fns/locale'
import { MessageSquare, Phone, Video } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContactStore } from '../stores/contactStore'

const emit = defineEmits<{
  message: [userId: string]
  audioCall: [userId: string]
  videoCall: [userId: string]
}>()

const { t, locale } = useI18n()

const store = useContactStore()

const contact = computed(() =>
  store.contacts.find(c => c.userId === store.selectedContactId),
)

const presenceInfo = computed(() => {
  if (!contact.value)
    return null
  return getUserPresenceInfo(contact.value.userId)
})

const presenceLabel = computed(() => {
  if (!presenceInfo.value)
    return t('contacts.offline')
  const { presence, lastActiveAgo } = presenceInfo.value
  if (presence === 'online')
    return t('contacts.online')
  if (lastActiveAgo && lastActiveAgo > 0) {
    const lastSeenDate = new Date(Date.now() - lastActiveAgo)
    const dateFnsLocale = locale.value === 'zh' ? zhCN : enUS
    return `${formatDistanceToNow(lastSeenDate, { locale: dateFnsLocale, addSuffix: true })}${t('contacts.online')}`
  }
  return t('contacts.offline')
})
</script>

<template>
  <div v-if="contact" class="flex flex-col items-center p-6">
    <div class="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-medium mb-3">
      {{ contact.displayName.slice(0, 1) }}
    </div>
    <h3 class="font-medium text-lg">
      {{ contact.displayName }}
    </h3>
    <p class="text-sm text-muted-foreground mb-1">
      {{ contact.userId }}
    </p>
    <div
      class="flex items-center gap-1 text-xs"
      :class="[
        presenceInfo?.presence === 'online' ? 'text-green-500' : 'text-muted-foreground',
        presenceInfo?.statusMsg ? 'mb-1' : 'mb-6',
      ]"
    >
      <div
        class="w-2 h-2 rounded-full"
        :class="presenceInfo?.presence === 'online' ? 'bg-green-500' : 'bg-muted-foreground/30'"
      />
      {{ presenceLabel }}
    </div>

    <!-- 自定义状态 -->
    <p
      v-if="presenceInfo?.statusMsg"
      class="text-sm text-muted-foreground mb-4 max-w-[240px] truncate text-center"
    >
      {{ presenceInfo.statusMsg }}
    </p>

    <div class="flex items-center gap-3">
      <button
        class="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-accent"
        @click="emit('message', contact!.userId)"
      >
        <MessageSquare :size="20" class="text-primary" />
        <span class="text-xs">{{ t('contacts.message') }}</span>
      </button>
      <button
        class="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-accent"
        @click="emit('audioCall', contact!.userId)"
      >
        <Phone :size="20" class="text-primary" />
        <span class="text-xs">{{ t('contacts.voice_call') }}</span>
      </button>
      <button
        class="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-accent"
        @click="emit('videoCall', contact!.userId)"
      >
        <Video :size="20" class="text-primary" />
        <span class="text-xs">{{ t('contacts.video_call') }}</span>
      </button>
    </div>
  </div>

  <div v-else class="flex-1 flex items-center justify-center text-muted-foreground text-sm">
    {{ t('contacts.select_contact') }}
  </div>
</template>
