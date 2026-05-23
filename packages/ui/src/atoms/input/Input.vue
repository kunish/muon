<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import type { InputVariants } from '.';
import { useVModel } from '@vueuse/core';
import { inputVariants } from '.';
import { cn } from '../../utils';

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes['class'];
    type?: string;
    placeholder?: string;
    disabled?: boolean;
    defaultValue?: string | number;
    modelValue?: string | number;
    variant?: InputVariants['variant'];
    size?: InputVariants['size'];
  }>(),
  {
    type: 'text',
    variant: 'default',
    size: 'md',
  },
);

const emits = defineEmits<{ 'update:modelValue': [value: string | number] }>();

const modelValue = useVModel(props, 'modelValue', emits, {
  passive: true,
  defaultValue: props.defaultValue,
});
</script>

<template>
  <input
    v-model="modelValue"
    :class="cn(inputVariants({ variant, size }), props.class)"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
  />
</template>
