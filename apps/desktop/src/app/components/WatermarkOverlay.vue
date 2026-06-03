<script setup lang="ts">
import { useWatermark, useWatermarkGuard } from '@shared/composables/useWatermark';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{
  text: string;
}>();

const overlayRef = ref<HTMLElement | null>(null);
const { applyWatermark, removeWatermark, enabled } = useWatermark();

const { startGuard, stopGuard } = useWatermarkGuard(
  () => overlayRef.value?.parentElement ?? null,
  () => overlayRef.value,
);

function render() {
  if (overlayRef.value && enabled.value) {
    applyWatermark(overlayRef.value, props.text);
  }
}

// flush: 'post' 确保在 v-if 挂载/卸载完成后再读取 overlayRef，
// 否则启用瞬间 overlayRef 仍为 null，水印不会绘制
watch(
  [enabled, () => props.text],
  () => {
    if (overlayRef.value) {
      if (enabled.value) {
        applyWatermark(overlayRef.value, props.text);
      } else {
        removeWatermark(overlayRef.value);
      }
    }
  },
  { flush: 'post' },
);

// 元素刚挂载（启用）时重新绘制一次
watch(overlayRef, (el) => {
  if (el && enabled.value) {
    applyWatermark(el, props.text);
  }
});

onMounted(() => {
  render();
  startGuard(render);
});

onBeforeUnmount(() => {
  stopGuard();
});
</script>

<template>
  <div v-if="enabled" ref="overlayRef" class="fixed inset-0 z-[9999] pointer-events-none" />
</template>
