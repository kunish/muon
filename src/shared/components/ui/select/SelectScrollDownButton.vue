<script setup lang="ts">
import type { SelectScrollDownButtonProps } from 'reka-ui'
import { ChevronDownIcon } from 'lucide-vue-next'
import { SelectScrollDownButton, useForwardProps } from 'reka-ui'
import { cn } from '@/shared/lib/utils'

const props = defineProps<SelectScrollDownButtonProps & { class?: string }>()

const forwardedProps = useForwardProps(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <SelectScrollDownButton
    v-bind="forwardedProps"
    :class="cn('flex cursor-default items-center justify-center py-1', props.class)"
  >
    <slot>
      <ChevronDownIcon class="size-4" />
    </slot>
  </SelectScrollDownButton>
</template>
