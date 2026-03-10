<script setup lang="ts">
import type { DialogTitleProps } from 'reka-ui'
import { DialogTitle, useForwardProps } from 'reka-ui'
import { cn } from '@/shared/lib/utils'

const props = defineProps<DialogTitleProps & { class?: string }>()
const forwardedProps = useForwardProps(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <DialogTitle v-bind="forwardedProps" :class="cn('text-foreground text-lg font-semibold', props.class)">
    <slot />
  </DialogTitle>
</template>
