<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import {
  ContextMenuContent,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger,
} from 'radix-vue'
import { cn } from '@/shared/lib/utils'

defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <slot name="trigger" />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent
        :class="cn(
          'z-50 min-w-32 overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95',
          $props.class,
        )"
      >
        <slot />
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
