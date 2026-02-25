<script setup lang="ts">
import { mxcToHttp } from '@matrix/index'
import { Pause, Play } from 'lucide-vue-next'
import { computed, ref } from 'vue'

const props = defineProps<{
  event: any
}>()

const content = computed(() => props.event.getContent())
const audioUrl = computed(() => {
  const url = content.value?.url
  return url ? mxcToHttp(url) : ''
})
const duration = computed(() => {
  const ms = content.value?.info?.duration || 0
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
})

const playing = ref(false)
const progress = ref(0)
let audio: HTMLAudioElement | null = null

function toggle() {
  if (!audio) {
    audio = new Audio(audioUrl.value)
    audio.ontimeupdate = () => {
      if (audio)
        progress.value = (audio.currentTime / audio.duration) * 100
    }
    audio.onended = () => {
      playing.value = false
      progress.value = 0
    }
  }
  if (playing.value) {
    audio.pause()
  }
  else {
    audio.play()
  }
  playing.value = !playing.value
}
</script>

<template>
  <div class="flex items-center gap-2 min-w-[180px]">
    <button
      class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0"
      @click="toggle"
    >
      <Pause v-if="playing" :size="14" />
      <Play v-else :size="14" class="ml-0.5" />
    </button>
    <div class="flex-1">
      <div class="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          class="h-full bg-primary rounded-full transition-all"
          :style="{ width: `${progress}%` }"
        />
      </div>
    </div>
    <span class="text-xs text-muted-foreground shrink-0">{{ duration }}</span>
  </div>
</template>
