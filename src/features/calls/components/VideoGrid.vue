<script setup lang="ts">
import { computed } from 'vue'
import VideoTile from './VideoTile.vue'

const props = defineProps<{
  participants: Array<{ id: string, name: string, track?: any, muted?: boolean }>
  localTrack?: any
}>()

const gridCols = computed(() => {
  const count = props.participants.length + 1
  if (count <= 1)
    return 'grid-cols-1'
  if (count <= 4)
    return 'grid-cols-2'
  return 'grid-cols-3'
})
</script>

<template>
  <div class="flex-1 p-2 grid gap-2" :class="gridCols">
    <VideoTile
      :track="localTrack"
      name="我"
      local
    />
    <VideoTile
      v-for="p in participants"
      :key="p.id"
      :track="p.track"
      :name="p.name"
      :muted="p.muted"
    />
  </div>
</template>
