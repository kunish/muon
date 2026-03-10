<script setup lang="ts">
import type { TabsRootProps } from 'reka-ui'
import { TabsRoot, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@/shared/lib/utils'

const props = defineProps<TabsRootProps & { class?: string }>()

const emits = defineEmits<{
  'update:modelValue': [payload: string | number]
}>()

const forwarded = useForwardPropsEmits(() => {
  const { class: _, ...delegated } = props
  return delegated
}, emits)
</script>

<template>
  <TabsRoot v-bind="forwarded" :class="cn('flex flex-col gap-2', props.class)">
    <slot />
  </TabsRoot>
</template>
