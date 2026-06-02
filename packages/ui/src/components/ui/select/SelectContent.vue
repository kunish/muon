<script setup lang="ts">
import type { SelectContentProps } from 'reka-ui';
import { SelectContent, SelectPortal, SelectViewport, useForwardPropsEmits } from 'reka-ui';
import { cn } from '../../../utils';
import SelectScrollDownButton from './SelectScrollDownButton.vue';
import SelectScrollUpButton from './SelectScrollUpButton.vue';

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(defineProps<SelectContentProps & { class?: string }>(), {
  position: 'popper',
  class: undefined,
});

const emits = defineEmits<{
  closeAutoFocus: [event: Event];
}>();

const forwarded = useForwardPropsEmits(() => {
  const { class: _, ...delegated } = props;
  return delegated;
}, emits);
</script>

<template>
  <SelectPortal>
    <SelectContent
      v-bind="{ ...forwarded, ...$attrs }"
      :class="
        cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--reka-select-content-available-height) origin-(--reka-select-content-transform-origin) overflow-x-hidden rounded-md border shadow-md',
          position === 'popper'
            ? 'min-w-(--reka-select-trigger-width) data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1'
            : 'min-w-[8rem]',
          props.class,
        )
      "
    >
      <SelectScrollUpButton />
      <SelectViewport :class="cn('p-1', position === 'popper' && 'w-full min-w-(--reka-select-trigger-width)')">
        <slot />
      </SelectViewport>
      <SelectScrollDownButton />
    </SelectContent>
  </SelectPortal>
</template>
