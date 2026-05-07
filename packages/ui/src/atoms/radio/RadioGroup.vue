<script setup lang="ts">
import { RadioGroupRoot } from 'reka-ui'
import { computed } from 'vue'
import { cn } from '../../utils'

const props = defineProps({
  modelValue: { type: String, default: undefined },
  defaultValue: { type: String, default: undefined },
  disabled: { type: Boolean, default: undefined },
  class: { type: String, default: undefined },
})

const emits = defineEmits<{ 'update:modelValue': [value: string] }>()

const rootProps = computed(() => {
  const out: Record<string, unknown> = {}
  if (props.modelValue !== undefined)
    out.modelValue = props.modelValue
  if (props.defaultValue !== undefined)
    out.defaultValue = props.defaultValue
  if (props.disabled !== undefined)
    out.disabled = props.disabled
  return out
})

function onUpdate(value: unknown) {
  if (typeof value === 'string' && value)
    emits('update:modelValue', value)
}
</script>

<template>
  <RadioGroupRoot
    v-bind="rootProps"
    :class="cn('flex flex-col gap-2', props.class)"
    @update:model-value="onUpdate"
  >
    <slot />
  </RadioGroupRoot>
</template>
