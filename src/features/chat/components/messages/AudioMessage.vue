<script setup lang="ts">
import { fetchMediaBlobUrl } from '@matrix/index'
import { Pause, Play } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { Progress } from '@/shared/components/ui/progress'

const props = defineProps<{
  event: any
}>()

const content = computed(() => props.event.getContent())
const audioBlobUrl = ref('')

watch(content, async (c) => {
  const mxc = c?.url
  if (mxc)
    audioBlobUrl.value = await fetchMediaBlobUrl(mxc)
}, { immediate: true })
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
    audio = new Audio(audioBlobUrl.value)
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
      <Progress :model-value="progress" class="h-1.5" />
    </div>
    <span class="text-xs text-muted-foreground shrink-0">{{ duration }}</span>
  </div>
</template>
