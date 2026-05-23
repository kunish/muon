<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import type { FileChipVariants } from '.';
import { Download, File, X } from 'lucide-vue-next';
import { computed } from 'vue';
import { fileChipVariants, inferKind, KIND_COLOR } from '.';
import { cn } from '../../utils';

const props = withDefaults(
  defineProps<{
    name: string;
    size?: FileChipVariants['size'];
    byteSize?: string;
    removable?: boolean;
    downloadable?: boolean;
    class?: HTMLAttributes['class'];
  }>(),
  { size: 'md', removable: false, downloadable: false },
);

const emits = defineEmits<{
  remove: [];
  download: [];
}>();

const kind = computed(() => inferKind(props.name));
const iconColor = computed(() => KIND_COLOR[kind.value]);
</script>

<template>
  <span :class="cn(fileChipVariants({ size }), props.class)" :data-testid="$attrs['data-testid']" :data-kind="kind">
    <File class="size-4 shrink-0" :style="{ color: iconColor }" aria-hidden="true" />
    <span class="max-w-[200px] truncate text-foreground">{{ name }}</span>
    <span v-if="byteSize" class="text-[11px] text-gray-500">{{ byteSize }}</span>
    <button
      v-if="downloadable"
      type="button"
      class="ml-1 inline-flex items-center justify-center text-gray-500 hover:text-gray-700"
      data-testid="file-chip-download"
      @click="emits('download')"
    >
      <Download class="size-3.5" />
    </button>
    <button
      v-if="removable"
      type="button"
      class="ml-1 inline-flex items-center justify-center text-gray-500 hover:text-gray-700"
      data-testid="file-chip-remove"
      @click="emits('remove')"
    >
      <X class="size-3.5" />
    </button>
  </span>
</template>

<style scoped>
.bg-file-chip-bg {
  background-color: var(--color-file-chip-bg);
}
.hover\:bg-file-chip-hover-bg:hover {
  background-color: var(--color-file-chip-hover-bg);
}
</style>
