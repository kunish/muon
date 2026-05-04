<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import { computed } from 'vue'
import { cn } from '../../../utils'

const props = defineProps({
  checked: { type: Boolean, default: undefined },
  class: { type: String, default: undefined },
  defaultChecked: { type: Boolean, default: undefined },
  disabled: { type: Boolean, default: undefined },
  falseValue: { type: Boolean, default: undefined },
  id: { type: String, default: undefined },
  name: { type: String, default: undefined },
  required: { type: Boolean, default: undefined },
  trueValue: { type: Boolean, default: undefined },
  value: { type: String, default: undefined },
})

const emits = defineEmits<{
  'update:checked': [payload: boolean]
}>()

const delegatedProps = computed(() => {
  const {
    checked: _checked,
    class: _class,
    defaultChecked: _defaultChecked,
    falseValue: _falseValue,
    trueValue: _trueValue,
    ...delegated
  } = props

  const rootProps: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(delegated)) {
    if (value !== undefined)
      rootProps[key] = value
  }
  return rootProps
})
</script>

<template>
  <SwitchRoot
    v-bind="delegatedProps"
    :default-value="props.defaultChecked"
    :false-value="props.falseValue ?? false"
    :model-value="props.checked"
    :true-value="props.trueValue ?? true"
    :class="
      cn(
        'peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
    @update:model-value="value => emits('update:checked', value)"
  >
    <SwitchThumb
      :class="
        cn(
          'bg-background pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:-translate-x-0.5',
        )
      "
    />
  </SwitchRoot>
</template>
