<script setup lang="ts">
import type { CheckboxRootProps } from 'reka-ui'
import { CheckIcon, MinusIcon } from 'lucide-vue-next'
import { CheckboxIndicator, CheckboxRoot, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@/shared/lib/utils'

const props = defineProps<CheckboxRootProps & { class?: string }>()
const emits = defineEmits<{
  'update:modelValue': [payload: boolean | 'indeterminate']
}>()

const forwarded = useForwardPropsEmits(() => {
  const { class: _, ...delegated } = props
  return delegated
}, emits)
</script>

<template>
  <CheckboxRoot
    v-bind="forwarded"
    :class="
      cn(
        'peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
  >
    <CheckboxIndicator class="flex items-center justify-center text-current transition-none">
      <CheckIcon v-if="props.modelValue !== 'indeterminate'" class="size-3.5" />
      <MinusIcon v-else class="size-3.5" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
