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
  <div v-if="contact" class="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto p-6">
    <div class="workspace-surface mx-auto w-full max-w-[720px] rounded-lg p-6">
      <div class="flex items-start gap-4">
        <div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-2xl font-semibold text-primary">
          {{ contact.displayName.slice(0, 1) }}
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="truncate text-[24px] font-semibold leading-8">
            {{ contact.displayName }}
          </h3>
          <p class="mt-1 truncate text-[13px] text-muted-foreground">
            {{ contact.userId }}
          </p>
          <div
            class="mt-3 flex items-center gap-1.5 text-[12px] font-semibold"
            :class="presenceInfo?.presence === 'online' ? 'text-success' : 'text-muted-foreground'"
          >
            <div
              class="h-2 w-2 rounded-full"
              :class="presenceInfo?.presence === 'online' ? 'bg-success' : 'bg-muted-foreground/30'"
            />
            {{ presenceLabel }}
          </div>
          <p
            v-if="presenceInfo?.statusMsg"
            class="mt-2 max-w-[420px] truncate text-[13px] text-muted-foreground"
          >
            {{ presenceInfo.statusMsg }}
          </p>
        </div>
      </div>

      <div class="mt-6 grid gap-2 sm:grid-cols-3">
        <button
          class="flex h-20 flex-col items-center justify-center gap-2 rounded-md border border-border bg-muted text-[12px] font-semibold transition-colors hover:bg-accent"
          @click="emit('message', contact!.userId)"
        >
          <MessageSquare :size="20" class="text-primary" />
          <span>{{ t('contacts.message') }}</span>
        </button>
        <button
          class="flex h-20 flex-col items-center justify-center gap-2 rounded-md border border-border bg-muted text-[12px] font-semibold transition-colors hover:bg-accent"
          @click="emit('audioCall', contact!.userId)"
        >
          <Phone :size="20" class="text-primary" />
          <span>{{ t('contacts.voice_call') }}</span>
        </button>
        <button
          class="flex h-20 flex-col items-center justify-center gap-2 rounded-md border border-border bg-muted text-[12px] font-semibold transition-colors hover:bg-accent"
          @click="emit('videoCall', contact!.userId)"
        >
          <Video :size="20" class="text-primary" />
          <span>{{ t('contacts.video_call') }}</span>
        </button>
      </div>
    </div>
  </div>

  <div v-else class="flex min-h-0 w-full min-w-0 flex-1 items-center justify-center text-sm text-muted-foreground">
    {{ t('contacts.select_contact') }}
  </div>
</template>
