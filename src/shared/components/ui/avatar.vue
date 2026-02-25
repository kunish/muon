<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed, ref } from 'vue'
import { cn } from '@/shared/lib/utils'

const props = withDefaults(defineProps<{
  src?: string
  alt?: string
  fallback?: string
  size?: 'sm' | 'default' | 'lg'
  class?: HTMLAttributes['class']
}>(), {
  size: 'default',
})

const imgError = ref(false)

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  default: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
}

const classes = computed(() => cn(
  'relative flex shrink-0 overflow-hidden rounded-full',
  sizeClasses[props.size],
  props.class,
))
</script>

<template>
  <span :class="classes">
    <img
      v-if="src && !imgError"
      :src="src"
      :alt="alt"
      class="aspect-square h-full w-full object-cover"
      @error="imgError = true"
    >
    <span
      v-else
      class="flex h-full w-full items-center justify-center rounded-full bg-muted font-medium text-muted-foreground"
    >
      {{ fallback || alt?.charAt(0)?.toUpperCase() || '?' }}
    </span>
  </span>
</template>
