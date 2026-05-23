<script setup lang="ts">
import { cn } from '../../../utils';

const props = defineProps<{ class?: string }>();
</script>

<template>
  <p :class="cn('text-muted-foreground text-sm', props.class)">
    <slot />
  </p>
</template>
