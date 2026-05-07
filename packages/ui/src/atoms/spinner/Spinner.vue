<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../../utils'

const props = withDefaults(defineProps<{
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  class?: HTMLAttributes['class']
  label?: string
}>(), { size: 'md', label: 'Loading' })

const SIZE: Record<string, string> = {
  xs: 'size-3 border-[1.5px]',
  sm: 'size-3.5 border-[1.5px]',
  md: 'size-4 border-2',
  lg: 'size-5 border-2',
  xl: 'size-6 border-[2.5px]',
}
</script>

<template>
  <span
    role="status"
    :aria-label="label"
    :class="cn(
      'inline-block rounded-full animate-spin',
      'border-current border-t-transparent',
      SIZE[size],
      props.class,
    )"
    style="animation-duration: 0.9s"
  />
</template>
