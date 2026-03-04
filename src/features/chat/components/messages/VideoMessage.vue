<script setup lang="ts">
import { fetchMediaBlobUrl } from '@matrix/index'
import { Play } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMediaViewer } from '../../composables/useMediaViewer'

const props = defineProps<{
  event: any
}>()

const { openVideo } = useMediaViewer()
const { t } = useI18n()

const content = computed(() => props.event.getContent())
const thumbBlobUrl = ref('')
const videoBlobUrl = ref('')
const loading = ref(false)

watch(content, async (c) => {
  const thumbMxc = c?.info?.thumbnail_url
  if (thumbMxc)
    thumbBlobUrl.value = await fetchMediaBlobUrl(thumbMxc, 300, 200)

  const videoMxc = c?.url
  if (videoMxc) {
    loading.value = true
    videoBlobUrl.value = await fetchMediaBlobUrl(videoMxc)
    loading.value = false
  }
}, { immediate: true })

function handleClick() {
  if (videoBlobUrl.value)
    openVideo(videoBlobUrl.value)
}
const duration = computed(() => {
  const ms = content.value?.info?.duration || 0
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
})
</script>

<template>
  <div
    class="rounded-lg overflow-hidden max-w-[300px] relative"
    :class="videoBlobUrl ? 'cursor-pointer' : 'cursor-wait'"
    @click="handleClick"
  >
    <img
      v-if="thumbBlobUrl"
      :src="thumbBlobUrl"
      :alt="content?.body || t('chat.video_alt')"
      class="max-w-full max-h-[300px] object-cover"
    >
    <video
      v-else-if="videoBlobUrl"
      :src="`${videoBlobUrl}#t=0.1`"
      preload="auto"
      muted
      class="max-w-full max-h-[300px] object-cover pointer-events-none"
    />
    <div v-else class="w-[250px] h-[180px] bg-muted animate-pulse rounded-lg" />
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
        <Play :size="20" class="text-white ml-0.5" />
      </div>
    </div>
    <div v-if="duration !== '0:00'" class="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
      {{ duration }}
    </div>
  </div>
</template>
