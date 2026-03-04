<script setup lang="ts">
import { Camera, Loader2 } from 'lucide-vue-next'
import { ref } from 'vue'
import { captureScreen } from '@/tauri/screenshot'

const emit = defineEmits<{
  capture: [file: File]
}>()

const loading = ref(false)

async function takeScreenshot() {
  if (loading.value)
    return
  loading.value = true
  try {
    const blob = await captureScreen()
    if (blob) {
      const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' })
      emit('capture', file)
    }
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <button
    class="p-1.5 rounded-md hover:bg-accent text-muted-foreground disabled:opacity-50"
    :disabled="loading"
    :title="$t('chat.screenshot')"
    @click="takeScreenshot"
  >
    <Loader2 v-if="loading" :size="18" class="animate-spin" />
    <Camera v-else :size="18" />
  </button>
</template>
