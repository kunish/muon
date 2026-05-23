<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import type { BadgeVariants } from '.';
import { badgeVariants } from '.';
import { cn } from '../../utils';

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes['class'];
    tone?: BadgeVariants['tone'];
    style?: BadgeVariants['style'];
  }>(),
  { tone: 'neutral', style: 'subtle' },
);
</script>

<template>
  <span :class="cn(badgeVariants({ tone, style: props.style }), props.class)">
    <slot />
  </span>
</template>
