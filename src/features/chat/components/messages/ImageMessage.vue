<script setup lang="ts">
import { getThumbnailUrl, mxcToHttp } from '@matrix/index'
import { computed } from 'vue'
import { useMediaViewer } from '../../composables/useMediaViewer'

const props = defineProps<{
  event: any
}>()

const { openImage } = useMediaViewer()

const content = computed(() => props.event.getContent())
const thumbUrl = computed(() => {
  const url = content.value?.url
  return url ? getThumbnailUrl(url, 300, 300) : ''
})
const fullUrl = computed(() => {
  const url = content.value?.url
  return url ? mxcToHttp(url) : ''
})
</script>

<template>
  <div
    class="cursor-pointer rounded-lg overflow-hidden max-w-[300px]"
    @click="openImage(fullUrl)"
  >
    <img
      v-if="thumbUrl"
      :src="thumbUrl"
      :alt="content?.body || '图片'"
      class="max-w-full max-h-[400px] object-contain"
      loading="lazy"
    >
    <div v-else class="w-[200px] h-[150px] bg-muted animate-pulse rounded-lg" />
  </div>
</template>
