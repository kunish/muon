<script setup lang="ts">
import { Monitor, X } from 'lucide-vue-next'

const emit = defineEmits<{
  select: [stream: MediaStream]
  cancel: []
}>()

async function pickScreen() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    })
    emit('select', stream)
  }
  catch {
    emit('cancel')
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
    <div class="bg-background rounded-xl shadow-2xl p-6 w-[320px]">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-medium">
          选择共享内容
        </h3>
        <button class="p-1 rounded hover:bg-accent" @click="emit('cancel')">
          <X :size="16" />
        </button>
      </div>
      <button
        class="w-full p-4 rounded-lg border border-border hover:bg-accent flex flex-col items-center gap-2"
        @click="pickScreen"
      >
        <Monitor :size="32" class="text-muted-foreground" />
        <span class="text-sm">选择屏幕或窗口</span>
      </button>
    </div>
  </div>
</template>
