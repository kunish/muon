<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { computed } from 'vue';
import { sanitizeMatrixHtml } from '../htmlSanitizer';

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes['class'];
    html: string;
    sanitize?: boolean;
  }>(),
  {
    sanitize: true,
  },
);

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const renderedHtml = computed(() => {
  if (!props.html) return '';
  return props.sanitize ? sanitizeMatrixHtml(props.html) : props.html;
});
</script>

<template>
  <div
    v-if="renderedHtml"
    v-bind="$attrs"
    class="rich-message-content"
    :class="props.class"
    @click="emit('click', $event)"
    v-html="renderedHtml"
  />
</template>
