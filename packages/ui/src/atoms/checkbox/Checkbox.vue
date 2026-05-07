<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui'
import { computed } from 'vue'
import { cn } from '../../utils'

const props = defineProps({
  modelValue: { type: [Boolean, String], default: undefined },
  defaultChecked: { type: [Boolean, String], default: undefined },
  disabled: { type: Boolean, default: undefined },
  size: { type: String, default: 'md' },
  class: { type: String, default: undefined },
})

const emits = defineEmits<{ 'update:modelValue': [value: boolean | 'indeterminate'] }>()

const SIZE: Record<string, string> = {
  sm: 'size-3.5',
  md: 'size-4',
}

const rootProps = computed(() => {
  const out: Record<string, unknown> = {}
  if (props.modelValue !== undefined)
    out.modelValue = props.modelValue
  if (props.defaultChecked !== undefined)
    out.defaultValue = props.defaultChecked
  if (props.disabled !== undefined)
    out.disabled = props.disabled
  return out
})

function onUpdate(value: boolean | 'indeterminate') {
  emits('update:modelValue', value)
}
</script>

<template>
  <CheckboxRoot
    v-bind="rootProps"
    :class="cn(
      'inline-flex shrink-0 items-center justify-center rounded-xs border border-gray-300 bg-card transition-colors',
      'data-[state=checked]:bg-primary data-[state=checked]:border-primary',
      'data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary',
      'disabled:cursor-not-allowed disabled:bg-gray-100 disabled:border-gray-200',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]',
      SIZE[props.size],
      props.class,
    )"
    @update:model-value="onUpdate"
  >
    <CheckboxIndicator class="flex items-center justify-center text-white">
      <Check v-if="props.modelValue === true" class="size-3 stroke-[2.5]" />
      <span v-else-if="props.modelValue === 'indeterminate'" data-testid="checkbox-indeterminate" class="block h-0.5 w-2 bg-white" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
