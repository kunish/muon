<script setup lang="ts">
import { MapPin } from 'lucide-vue-next'
import { computed } from 'vue'

const props = defineProps<{
  geoUri: string
  body: string
}>()

const GEO_URI_RE = /^geo:([-\d.]+),([-\d.]+)/

const coords = computed(() => {
  const match = props.geoUri.match(GEO_URI_RE)
  if (!match)
    return null
  return { lat: Number.parseFloat(match[1]), lng: Number.parseFloat(match[2]) }
})

const osmUrl = computed(() => {
  if (!coords.value)
    return ''
  return `https://www.openstreetmap.org/?mlat=${coords.value.lat}&mlon=${coords.value.lng}#map=16/${coords.value.lat}/${coords.value.lng}`
})
</script>

<template>
  <a
    v-if="coords"
    :href="osmUrl"
    target="_blank"
    rel="noopener noreferrer"
    class="flex items-start gap-2.5 p-2.5 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer no-underline min-w-[200px]"
  >
    <div class="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
      <MapPin :size="18" />
    </div>
    <div class="flex flex-col gap-0.5 min-w-0">
      <span class="text-sm font-medium text-foreground truncate">{{ body }}</span>
      <span class="text-[11px] text-muted-foreground">
        {{ coords.lat.toFixed(6) }}, {{ coords.lng.toFixed(6) }}
      </span>
    </div>
  </a>
</template>
