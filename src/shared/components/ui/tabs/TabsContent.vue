<script setup lang="ts">
import type { TabsContentProps } from 'reka-ui'
import { TabsContent, useForwardProps } from 'reka-ui'
import { cn } from '@/shared/lib/utils'

const props = defineProps<TabsContentProps & { class?: string }>()

const forwardedProps = useForwardProps(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <TabsContent v-bind="forwardedProps" :class="cn('flex-1 outline-none', props.class)">
    <slot />
  </TabsContent>
</template>
