<script setup lang="ts">
import type { TooltipContentProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { TooltipContent, TooltipPortal } from 'reka-ui';
import { cn } from '../../../utils';

interface Props extends TooltipContentProps {
  class?: HTMLAttributes['class'];
}

const props = withDefaults(defineProps<Props>(), {
  sideOffset: 4,
  side: 'top',
});
</script>

<template>
  <TooltipPortal>
    <TooltipContent
      v-bind="{ ...props, class: undefined }"
      :class="
        cn(
          // Feishu tooltip pattern: inverse-of-surface — dark callout on light pages,
          // light callout on dark pages. bg-foreground/text-background auto-inverts
          // because both tokens flip with the theme.
          'z-50 overflow-hidden rounded-md bg-foreground px-3 py-1.5 text-sm text-background shadow-md animate-in fade-in-0 zoom-in-95',
          props.class,
        )
      "
    >
      <slot />
    </TooltipContent>
  </TooltipPortal>
</template>
