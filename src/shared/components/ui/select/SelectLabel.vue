<script setup lang="ts">
import type { SelectLabelProps } from 'reka-ui'
import { SelectLabel, useForwardProps } from 'reka-ui'
import { cn } from '@/shared/lib/utils'

const props = defineProps<SelectLabelProps & { class?: string }>()

const forwardedProps = useForwardProps(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <SelectLabel v-bind="forwardedProps" :class="cn('text-muted-foreground px-2 py-1.5 text-xs', props.class)">
    <slot />
  </SelectLabel>
</template>
