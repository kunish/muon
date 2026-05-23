<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { useVModel } from '@vueuse/core';
import { computed } from 'vue';
import Input from '../../../atoms/input/Input.vue';
import { cn } from '../../../utils';
import Label from '../label/Label.vue';

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes['class'];
    controlClass?: HTMLAttributes['class'];
    defaultValue?: string | number;
    error?: string;
    hint?: string;
    id?: string;
    label?: string;
    modelValue?: string | number;
  }>(),
  {
    defaultValue: '',
  },
);

const emits = defineEmits<{
  'update:modelValue': [value: string | number];
}>();

const modelValue = useVModel(props, 'modelValue', emits, {
  passive: true,
  defaultValue: props.defaultValue,
});

const generatedId = `muon-field-${Math.random().toString(36).slice(2)}`;
const controlId = computed(() => props.id || generatedId);
const descriptionId = computed(() => `${controlId.value}-description`);
const hasDescription = computed(() => Boolean(props.error || props.hint));
</script>

<template>
  <div :class="cn('grid gap-1.5', props.class)">
    <Label v-if="label" :for="controlId">{{ label }}</Label>
    <div
      :class="
        cn(
          'flex min-h-10 w-full items-center rounded-xl border border-input bg-card text-sm shadow-[inset_0_1px_0_color-mix(in_srgb,var(--color-foreground)_4%,transparent)] transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
          error && 'border-destructive focus-within:border-destructive focus-within:ring-destructive/20',
          props.controlClass,
        )
      "
    >
      <span v-if="$slots.prefix" class="flex shrink-0 items-center pl-3 text-muted-foreground">
        <slot name="prefix" />
      </span>
      <Input
        v-bind="$attrs"
        :id="controlId"
        v-model="modelValue"
        :aria-describedby="hasDescription ? descriptionId : undefined"
        :aria-invalid="error ? 'true' : undefined"
        class="h-10 rounded-none border-0 bg-transparent shadow-none focus-visible:border-transparent focus-visible:ring-0"
      />
      <span v-if="$slots.suffix" class="flex shrink-0 items-center pr-3 text-muted-foreground">
        <slot name="suffix" />
      </span>
    </div>
    <p
      v-if="hasDescription"
      :id="descriptionId"
      class="text-xs leading-5"
      :class="error ? 'text-destructive' : 'text-muted-foreground'"
    >
      {{ error || hint }}
    </p>
  </div>
</template>
