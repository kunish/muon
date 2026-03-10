<script setup lang="ts">
import type { SelectScrollUpButtonProps } from 'reka-ui'
import { ChevronUpIcon } from 'lucide-vue-next'
import { SelectScrollUpButton, useForwardProps } from 'reka-ui'
import { cn } from '@/shared/lib/utils'

const props = defineProps<SelectScrollUpButtonProps & { class?: string }>()

const forwardedProps = useForwardProps(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <SelectScrollUpButton
    v-bind="forwardedProps"
    :class="cn('flex cursor-default items-center justify-center py-1', props.class)"
  >
    <slot>
      <ChevronUpIcon class="size-4" />
    </slot>
  </SelectScrollUpButton>
</template>
