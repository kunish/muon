<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '../../utils';

withDefaults(
  defineProps<{
    orientation?: 'horizontal' | 'vertical';
    inset?: boolean;
    class?: HTMLAttributes['class'];
  }>(),
  { orientation: 'horizontal', inset: false },
);
</script>

<template>
  <div
    role="separator"
    :aria-orientation="orientation"
    :class="
      cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        inset && (orientation === 'horizontal' ? 'ml-3' : 'mt-3'),
        $attrs.class as any,
      )
    "
  />
</template>
