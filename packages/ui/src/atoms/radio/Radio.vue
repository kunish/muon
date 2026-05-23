<script setup lang="ts">
import { RadioGroupIndicator, RadioGroupItem } from 'reka-ui';
import { cn } from '../../utils';

const props = defineProps({
  value: { type: String, required: true },
  size: { type: String, default: 'md' },
  class: { type: String, default: undefined },
});

const SIZE: Record<string, string> = {
  sm: 'size-3.5',
  md: 'size-4',
};
const DOT_SIZE: Record<string, string> = {
  sm: 'size-1.5',
  md: 'size-1.5',
};
</script>

<template>
  <RadioGroupItem
    :value="props.value"
    :class="
      cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-gray-300 bg-card transition-colors',
        'data-[state=checked]:border-primary',
        'disabled:cursor-not-allowed disabled:bg-gray-100',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]',
        SIZE[props.size],
        props.class,
      )
    "
  >
    <RadioGroupIndicator :class="cn('rounded-full bg-primary', DOT_SIZE[props.size])" />
  </RadioGroupItem>
</template>
