<script setup lang="ts">
import type { AlertDialogDescriptionProps } from 'reka-ui'
import { AlertDialogDescription, useForwardProps } from 'reka-ui'
import { cn } from '@/shared/lib/utils'

const props = defineProps<AlertDialogDescriptionProps & { class?: string }>()

const forwardedProps = useForwardProps(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <AlertDialogDescription v-bind="forwardedProps" :class="cn('text-muted-foreground text-sm', props.class)">
    <slot />
  </AlertDialogDescription>
</template>
