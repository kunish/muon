<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui';
import { computed } from 'vue';
import { cn } from '../../utils';

const props = defineProps({
  modelValue: { type: Boolean, default: undefined },
  defaultChecked: { type: Boolean, default: undefined },
  disabled: { type: Boolean, default: undefined },
  size: { type: String, default: 'md' },
  class: { type: String, default: undefined },
});

const emits = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const SIZE_ROOT: Record<string, string> = {
  sm: 'h-3.5 w-6 [&[data-state=checked]>span]:translate-x-2.5',
  md: 'h-4 w-7 [&[data-state=checked]>span]:translate-x-3',
};
const SIZE_THUMB: Record<string, string> = {
  sm: 'size-3',
  md: 'size-3.5',
};

const rootProps = computed(() => {
  const out: Record<string, unknown> = {};
  if (props.modelValue !== undefined) out.modelValue = props.modelValue;
  if (props.defaultChecked !== undefined) out.defaultValue = props.defaultChecked;
  if (props.disabled !== undefined) out.disabled = props.disabled;
  return out;
});

function onUpdate(value: boolean) {
  emits('update:modelValue', value);
}
</script>

<template>
  <SwitchRoot
    v-bind="rootProps"
    :class="
      cn(
        'inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors',
        'data-[state=checked]:bg-primary data-[state=unchecked]:bg-gray-300 dark:data-[state=unchecked]:bg-gray-700',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]',
        SIZE_ROOT[props.size],
        props.class,
      )
    "
    @update:model-value="onUpdate"
  >
    <SwitchThumb
      :class="
        cn(
          'pointer-events-none block translate-x-0.5 rounded-full bg-white shadow-sm transition-transform',
          SIZE_THUMB[props.size],
        )
      "
    />
  </SwitchRoot>
</template>
