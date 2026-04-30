<script setup lang="ts">
import { useWatermark, useWatermarkGuard } from '@shared/composables/useWatermark'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  text: string
}>()

const overlayRef = ref<HTMLElement | null>(null)
const { applyWatermark, removeWatermark, enabled } = useWatermark()

const { startGuard, stopGuard } = useWatermarkGuard(
  () => overlayRef.value?.parentElement ?? null,
  () => overlayRef.value,
)

function render() {
  if (overlayRef.value && enabled.value) {
    applyWatermark(overlayRef.value, props.text)
  }
}

watch([enabled, () => props.text], () => {
  if (overlayRef.value) {
    if (enabled.value) {
      applyWatermark(overlayRef.value, props.text)
    }
    else {
      removeWatermark(overlayRef.value)
    }
  }
})

onMounted(() => {
  render()
  startGuard(render)
})

onBeforeUnmount(() => {
  stopGuard()
})
</script>

<template>
  <div
    v-if="enabled"
    ref="overlayRef"
    class="fixed inset-0 z-[9999] pointer-events-none"
  />
</template>
