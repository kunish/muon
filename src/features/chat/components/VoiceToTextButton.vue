<script setup lang="ts">
import { Mic, MicOff } from 'lucide-vue-next'
import { onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { createSpeechRecognizer, isSpeechRecognitionSupported } from '@/shared/lib/speechToText'

const emit = defineEmits<{
  transcript: [text: string]
}>()

const { t, locale } = useI18n()

const supported = isSpeechRecognitionSupported()
const isListening = ref(false)
let recognizer: ReturnType<typeof createSpeechRecognizer> | null = null

function toggle() {
  if (!supported)
    return
  if (isListening.value) {
    stop()
  }
  else {
    start()
  }
}

function start() {
  recognizer = createSpeechRecognizer({
    lang: locale.value === 'zh' ? 'zh-CN' : 'en-US',
    continuous: true,
    onResult: (result) => {
      if (result.isFinal) {
        emit('transcript', result.text)
      }
    },
    onError: () => {
      isListening.value = false
    },
    onEnd: () => {
      isListening.value = false
    },
  })
  recognizer.start()
  isListening.value = true
}

function stop() {
  recognizer?.stop()
  recognizer = null
  isListening.value = false
}

onBeforeUnmount(() => {
  recognizer?.abort()
})
</script>

<template>
  <button
    class="relative p-1.5 rounded-md transition-colors"
    :class="[
      !supported
        ? 'text-muted-foreground/40 cursor-not-allowed'
        : isListening
          ? 'text-destructive'
          : 'text-muted-foreground hover:bg-accent',
    ]"
    :disabled="!supported"
    :title="!supported ? t('chat.stt_not_supported') : isListening ? t('chat.stt_stop') : t('chat.stt_start')"
    @click="toggle"
  >
    <Mic v-if="!isListening" :size="18" />
    <MicOff v-else :size="18" />
    <!-- 脉冲动画 -->
    <span
      v-if="isListening"
      class="absolute inset-0 rounded-md border-2 border-destructive animate-ping opacity-40"
    />
  </button>
</template>
