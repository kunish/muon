<script setup lang="ts">
import type { DialogOverlayProps } from 'reka-ui'
import { DialogOverlay, useForwardProps } from 'reka-ui'
import { cn } from '@/shared/lib/utils'

const props = defineProps<DialogOverlayProps & { class?: string }>()

const forwardedProps = useForwardProps(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <DialogOverlay
    v-bind="forwardedProps"
    :class="
      cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/80',
        props.class,
      )
    "
  />
</template>
