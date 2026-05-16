<script setup lang="ts">
import type { Component, HTMLAttributes } from 'vue'
import { cn } from '../../utils'

const props = withDefaults(defineProps<{
  as: Component
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  class?: HTMLAttributes['class']
  ariaLabel?: string
}>(), { size: 'md' })

const SIZE: Record<string, string> = {
  xs: 'size-3', // 12
  sm: 'size-3.5', // 14
  md: 'size-4', // 16
  lg: 'size-5', // 20
  xl: 'size-6', // 24
}
</script>

<template>
  <component
    :is="as"
    :class="cn(SIZE[size], 'shrink-0 stroke-[1.5]', props.class)"
    :aria-label="ariaLabel"
    :aria-hidden="ariaLabel ? undefined : true"
  />
</template>
