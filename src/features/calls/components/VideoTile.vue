<script setup lang="ts">
import { onMounted, ref } from 'vue'

const props = defineProps<{
  track?: any
  name: string
  muted?: boolean
  local?: boolean
}>()

const videoEl = ref<HTMLVideoElement>()

onMounted(() => {
  if (props.track && videoEl.value) {
    props.track.attach(videoEl.value)
  }
})
</script>

<template>
  <div class="relative bg-muted rounded-lg overflow-hidden">
    <video
      ref="videoEl"
      class="w-full h-full object-cover"
      :muted="local"
      autoplay
      playsinline
    />
    <div class="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
      {{ name }}{{ muted ? ' (已静音)' : '' }}
    </div>
  </div>
</template>
