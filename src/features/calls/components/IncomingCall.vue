<script setup lang="ts">
import { Phone, PhoneOff } from 'lucide-vue-next'
import { onMounted, onUnmounted, ref } from 'vue'

defineProps<{
  callerName: string
  callType: 'audio' | 'video'
}>()

const emit = defineEmits<{
  accept: []
  reject: []
}>()

const elapsed = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => {
    elapsed.value++
    if (elapsed.value >= 30)
      emit('reject')
  }, 1000)
})

onUnmounted(() => {
  if (timer)
    clearInterval(timer)
})
</script>

<template>
  <div class="fixed top-4 right-4 z-50 w-[280px] bg-background border border-border rounded-xl shadow-2xl p-4">
    <div class="flex items-center gap-3 mb-4">
      <div class="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-medium">
        {{ callerName.slice(0, 1) }}
      </div>
      <div>
        <div class="font-medium">
          {{ callerName }}
        </div>
        <div class="text-sm text-muted-foreground">
          {{ callType === 'video' ? '视频通话' : '语音通话' }}
        </div>
      </div>
    </div>
    <div class="flex items-center justify-center gap-4">
      <button
        class="w-12 h-12 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
        @click="emit('reject')"
      >
        <PhoneOff :size="20" />
      </button>
      <button
        class="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center"
        @click="emit('accept')"
      >
        <Phone :size="20" />
      </button>
    </div>
  </div>
</template>
