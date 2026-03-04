<script setup lang="ts">
import { Phone, PhoneIncoming, PhoneMissed, Video } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCallHistory } from '../composables/useCallHistory'

const { t } = useI18n()
const { history } = useCallHistory()

const isEmpty = computed(() => history.value.length === 0)

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full">
    <div class="h-14 border-b border-border flex items-center px-4">
      <h2 class="font-medium">
        {{ t('calls.history') }}
      </h2>
    </div>

    <div v-if="isEmpty" class="flex-1 flex items-center justify-center">
      <div class="text-center text-muted-foreground">
        <Phone :size="40" class="mx-auto mb-2 opacity-30" />
        <p class="text-sm">
          {{ t('calls.no_history') }}
        </p>
      </div>
    </div>

    <div v-else class="flex-1 overflow-y-auto">
      <div
        v-for="entry in history"
        :key="entry.callId"
        class="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
      >
        <div
          class="w-10 h-10 rounded-full flex items-center justify-center"
          :class="entry.missed
            ? 'bg-destructive/10 text-destructive'
            : 'bg-primary/10 text-primary'"
        >
          <PhoneMissed v-if="entry.missed" :size="18" />
          <Video v-else-if="entry.type === 'video'" :size="18" />
          <PhoneIncoming v-else :size="18" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium">
            {{ entry.initiator }}
          </div>
          <div class="text-xs text-muted-foreground">
            {{ entry.missed ? t('calls.missed') : formatDuration(entry.duration) }}
          </div>
        </div>
        <div class="text-xs text-muted-foreground">
          {{ formatTime(entry.timestamp) }}
        </div>
      </div>
    </div>
  </div>
</template>
