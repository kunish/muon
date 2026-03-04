<script setup lang="ts">
import { clearMyStatus, getMyStatus, setMyStatus } from '@matrix/index'
import { X } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{
  close: []
  updated: [status: string]
}>()

const { t } = useI18n()

const statusText = ref('')
const saving = ref(false)
const MAX_LENGTH = 100

const QUICK_EMOJIS = ['😊', '🎮', '📚', '🏖️', '💼', '🎵', '🏃', '☕', '🌙', '✈️']

onMounted(() => {
  statusText.value = getMyStatus()
})

function insertEmoji(emoji: string) {
  if (statusText.value.length + emoji.length <= MAX_LENGTH) {
    statusText.value = `${emoji} ${statusText.value}`
  }
}

async function saveStatus() {
  const text = statusText.value.trim()
  saving.value = true
  try {
    await setMyStatus(text)
    emit('updated', text)
    emit('close')
  }
  finally {
    saving.value = false
  }
}

async function onClearStatus() {
  saving.value = true
  try {
    await clearMyStatus()
    statusText.value = ''
    emit('updated', '')
    emit('close')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="w-[300px] p-3 space-y-3">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <span class="text-sm font-medium">{{ t('settings.status') }}</span>
      <button
        class="p-1 rounded-md hover:bg-accent text-muted-foreground"
        @click="emit('close')"
      >
        <X :size="14" />
      </button>
    </div>

    <!-- Input -->
    <div class="relative">
      <input
        v-model="statusText"
        :maxlength="MAX_LENGTH"
        :placeholder="t('settings.status_placeholder')"
        class="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
        @keydown.enter="saveStatus"
      >
      <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/40">
        {{ statusText.length }}/{{ MAX_LENGTH }}
      </span>
    </div>

    <!-- Hint -->
    <p class="text-[11px] text-muted-foreground/60">
      {{ t('settings.status_hint') }}
    </p>

    <!-- Quick Emojis -->
    <div class="flex flex-wrap gap-1">
      <button
        v-for="emoji in QUICK_EMOJIS"
        :key="emoji"
        class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent text-base transition-transform hover:scale-110 cursor-pointer"
        @click="insertEmoji(emoji)"
      >
        {{ emoji }}
      </button>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2">
      <button
        class="flex-1 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:brightness-110 transition-all disabled:opacity-50"
        :disabled="saving"
        @click="saveStatus"
      >
        {{ t('common.save') }}
      </button>
      <button
        class="h-8 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
        :disabled="saving"
        @click="onClearStatus"
      >
        {{ t('settings.status_clear') }}
      </button>
    </div>
  </div>
</template>
