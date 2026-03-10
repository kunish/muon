<script setup lang="ts">
import type { SelectSeparatorProps } from 'reka-ui'
import { SelectSeparator, useForwardProps } from 'reka-ui'
import { cn } from '@/shared/lib/utils'

const props = defineProps<SelectSeparatorProps & { class?: string }>()

const forwardedProps = useForwardProps(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <SelectSeparator
    v-bind="forwardedProps"
    :class="cn('bg-muted pointer-events-none -mx-1 my-1 h-px', props.class)"
  />
</template>
