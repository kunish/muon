<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { cn } from '@/shared/lib/utils'

type Variant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
type Size = 'default' | 'sm' | 'lg' | 'icon'

const props = withDefaults(defineProps<{
  variant?: Variant
  size?: Size
  class?: HTMLAttributes['class']
  disabled?: boolean
}>(), {
  variant: 'default',
  size: 'default',
})

const variantClasses: Record<Variant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/80 active:bg-primary/70',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/80 active:bg-destructive/70',
  outline: 'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  link: 'text-primary underline-offset-4 hover:underline',
}

const sizeClasses: Record<Size, string> = {
  default: 'h-10 px-4 py-2',
  sm: 'h-9 rounded-md px-3',
  lg: 'h-11 rounded-md px-8',
  icon: 'h-10 w-10',
}

const classes = computed(() => cn(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  variantClasses[props.variant],
  sizeClasses[props.size],
  props.class,
))
</script>

<template>
  <button :class="classes" :disabled="disabled">
    <slot />
  </button>
</template>
