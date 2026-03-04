<script setup lang="ts">
import { Mic, Square, X } from 'lucide-vue-next'
import { computed } from 'vue'
import { useVoiceRecorder } from '../composables/useVoiceRecorder'

const emit = defineEmits<{
  send: [blob: Blob, duration: number]
}>()

const { isRecording, duration, start, stop, cancel } = useVoiceRecorder()

const formattedDuration = computed(() => {
  const m = Math.floor(duration.value / 60)
  const s = duration.value % 60
  return `${m}:${String(s).padStart(2, '0')}`
})

async function handleStop() {
  const blob = await stop()
  if (blob) {
    emit('send', blob, duration.value * 1000)
  }
}
</script>

<template>
  <div v-if="isRecording" class="flex items-center gap-2">
    <button
      class="p-1.5 rounded-md hover:bg-accent text-destructive"
      @click="cancel"
    >
      <X :size="18" />
    </button>
    <div class="flex items-center gap-1.5">
      <div class="w-2 h-2 rounded-full bg-destructive animate-pulse" />
      <span class="text-xs text-muted-foreground tabular-nums">
        {{ formattedDuration }}
      </span>
    </div>
    <button
      class="p-1.5 rounded-md bg-primary text-primary-foreground"
      @click="handleStop"
    >
      <Square :size="14" />
    </button>
  </div>
  <button
    v-else
    class="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
    @click="start"
  >
    <Mic :size="18" />
  </button>
</template>
