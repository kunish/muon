<script setup lang="ts">
import type { TabsTriggerProps } from 'reka-ui'
import { TabsTrigger, useForwardProps } from 'reka-ui'
import { inject } from 'vue'
import { cn } from '../../../utils'
import type { TabsVariant } from './TabsList.vue'

const props = defineProps<TabsTriggerProps & { class?: string }>()

// Read the variant the surrounding TabsList provided. Default to 'segmented'
// so a Trigger used outside TabsList still renders.
const variant = inject<TabsVariant>('tabsListVariant', 'segmented')

const forwardedProps = useForwardProps(() => {
  const { class: _, ...delegated } = props
  return delegated
})

// Underline variant — Feishu approval-form / contacts-organization tab style:
// no container, transparent background, brand-color border-b on active.
// `-mb-px` lifts the trigger 1px so its 2px active underline overlaps and
// replaces the TabsList's 1px border-b at the active position.
const UNDERLINE_CLASSES = [
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap',
  'px-3 py-2 -mb-px text-sm font-medium border-b-2 border-transparent',
  'text-muted-foreground hover:text-foreground transition-colors',
  'data-[state=active]:text-foreground data-[state=active]:border-primary',
  'focus-visible:outline-none focus-visible:text-foreground',
  'disabled:pointer-events-none disabled:opacity-50',
  '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4',
].join(' ')

const SEGMENTED_CLASSES = 'data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-sm font-medium transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4'
</script>

<template>
  <TabsTrigger
    v-bind="forwardedProps"
    :class="cn(variant === 'underline' ? UNDERLINE_CLASSES : SEGMENTED_CLASSES, props.class)"
  >
    <slot />
  </TabsTrigger>
</template>
