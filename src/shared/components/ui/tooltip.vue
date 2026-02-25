<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'radix-vue'
import { computed } from 'vue'
import { cn } from '@/shared/lib/utils'

const props = withDefaults(defineProps<{
  content?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  class?: HTMLAttributes['class']
}>(), {
  side: 'top',
})

const contentClasses = computed(() => cn(
  'z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95',
  props.class,
))
</script>

<template>
  <TooltipProvider>
    <TooltipRoot>
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent :side="side" :class="contentClasses" :side-offset="4">
          <slot name="content">
            {{ content }}
          </slot>
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
