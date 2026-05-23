<script setup lang="ts">
import type { PopoverContentProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { PopoverContent, PopoverPortal } from 'reka-ui';
import { cn } from '../../../utils';

export type PopoverContentSize = 'sm' | 'md' | 'lg';

interface Props extends PopoverContentProps {
  class?: HTMLAttributes['class'];
  /**
   * Width preset. Defaults to `md` which preserves the prior `w-72` width
   * so existing call sites that don't pass `size` render unchanged.
   */
  size?: PopoverContentSize;
}

const props = withDefaults(defineProps<Props>(), {
  sideOffset: 4,
  size: 'md',
});
</script>

<template>
  <PopoverPortal>
    <PopoverContent
      v-bind="{ ...props, class: undefined, size: undefined }"
      :class="
        cn(
          'z-50 rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          props.size === 'sm' && 'w-60',
          props.size === 'md' && 'w-72',
          props.size === 'lg' && 'w-[400px]',
          props.class,
        )
      "
    >
      <slot />
    </PopoverContent>
  </PopoverPortal>
</template>
