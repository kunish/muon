<script setup lang="ts">
import { getThumbnailUrl, mxcToHttp } from '@matrix/index'
import { Play } from 'lucide-vue-next'
import { computed } from 'vue'
import { useMediaViewer } from '../../composables/useMediaViewer'

const props = defineProps<{
  event: any
}>()

const { openVideo } = useMediaViewer()

const content = computed(() => props.event.getContent())
const thumbUrl = computed(() => {
  const info = content.value?.info
  const url = info?.thumbnail_url
  return url ? getThumbnailUrl(url, 300, 200) : ''
})
const videoUrl = computed(() => {
  const url = content.value?.url
  return url ? mxcToHttp(url) : ''
})
const duration = computed(() => {
  const ms = content.value?.info?.duration || 0
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
})
</script>

<template>
  <div
    class="cursor-pointer rounded-lg overflow-hidden max-w-[300px] relative"
    @click="openVideo(videoUrl)"
  >
    <img
      v-if="thumbUrl"
      :src="thumbUrl"
      :alt="content?.body || '视频'"
      class="max-w-full max-h-[300px] object-cover"
    >
    <div v-else class="w-[250px] h-[180px] bg-muted rounded-lg" />
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
        <Play :size="20" class="text-white ml-0.5" />
      </div>
    </div>
    <div class="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
      {{ duration }}
    </div>
  </div>
</template>
