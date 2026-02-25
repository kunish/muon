<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { cn } from '@/shared/lib/utils'

const props = withDefaults(defineProps<{
  orientation?: 'horizontal' | 'vertical'
  class?: HTMLAttributes['class']
}>(), {
  orientation: 'horizontal',
})

const classes = computed(() => cn(
  'shrink-0 bg-border',
  props.orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
  props.class,
))
</script>

<template>
  <div role="separator" :class="classes" />
</template>
