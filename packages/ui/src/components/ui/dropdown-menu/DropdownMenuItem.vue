<script setup lang="ts">
import type { DropdownMenuItemEmits, DropdownMenuItemProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { DropdownMenuItem, useForwardPropsEmits } from 'reka-ui';
import { cn } from '../../../utils';

interface Props extends DropdownMenuItemProps {
  class?: HTMLAttributes['class'];
  inset?: boolean;
}

const props = defineProps<Props>();
const emits = defineEmits<DropdownMenuItemEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DropdownMenuItem
    v-bind="{ ...forwarded, class: undefined }"
    :class="
      cn(
        'flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-sm px-2.5 text-sm text-gray-900 outline-none transition-colors data-[highlighted]:bg-[var(--color-menu-item-hover-bg)] data-[disabled]:cursor-not-allowed data-[disabled]:text-gray-400 data-[variant=destructive]:text-destructive [&>svg]:size-4 [&>svg]:shrink-0',
        inset && 'pl-8',
        props.class,
      )
    "
  >
    <slot />
  </DropdownMenuItem>
</template>
