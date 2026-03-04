<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'radix-vue'
import { cn } from '@/shared/lib/utils'

defineProps<{
  class?: HTMLAttributes['class']
  side?: 'top' | 'right' | 'bottom' | 'left'
}>()
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :side="side"
        :class="cn(
          'z-50 w-72 rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          $props.class,
        )"
        :side-offset="4"
      >
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
