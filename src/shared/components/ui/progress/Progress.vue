<script setup lang="ts">
import type { ProgressRootProps } from 'reka-ui'
import { ProgressIndicator, ProgressRoot, useForwardProps } from 'reka-ui'
import { cn } from '@/shared/lib/utils'

const props = withDefaults(defineProps<ProgressRootProps & { class?: string }>(), {
  modelValue: 0,
})

const forwardedProps = useForwardProps(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <ProgressRoot
    v-bind="forwardedProps"
    :class="cn('bg-primary/20 relative h-2 w-full overflow-hidden rounded-full', props.class)"
  >
    <ProgressIndicator
      class="bg-primary h-full w-full flex-1 transition-all"
      :style="`transform: translateX(-${100 - (modelValue ?? 0)}%)`"
    />
  </ProgressRoot>
</template>
