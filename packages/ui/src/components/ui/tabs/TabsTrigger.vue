<script setup lang="ts">
import type { TabsTriggerProps } from 'reka-ui';
import type { TabsVariant } from './TabsList.vue';
import { TabsTrigger, useForwardProps } from 'reka-ui';
import { inject } from 'vue';
import { cn } from '../../../utils';

const props = defineProps<TabsTriggerProps & { class?: string }>();

// Read the variant the surrounding TabsList provided. Default to 'segmented'
// so a Trigger used outside TabsList still renders.
const variant = inject<TabsVariant>('tabsListVariant', 'segmented');

const forwardedProps = useForwardProps(() => {
  const { class: _, ...delegated } = props;
  return delegated;
});

// Underline variant — Feishu approval-form / contacts-organization tab style.
// Active indicator is a centered 18×2px brand-500 pill rendered via the
// `::after` pseudo-element, so it floats above the TabsList border instead
// of replacing it. `relative` on the trigger anchors the pseudo-element.
const UNDERLINE_CLASSES = [
  'relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap',
  'px-3 py-2 text-sm',
  'text-muted-foreground hover:text-foreground transition-colors',
  'data-[state=active]:text-gray-900 data-[state=active]:font-medium',
  "data-[state=active]:after:content-[''] data-[state=active]:after:absolute",
  'data-[state=active]:after:bottom-0 data-[state=active]:after:left-1/2',
  'data-[state=active]:after:-translate-x-1/2 data-[state=active]:after:h-0.5',
  'data-[state=active]:after:w-[18px] data-[state=active]:after:bg-brand-500 data-[state=active]:after:rounded-full',
  'focus-visible:outline-none focus-visible:text-foreground',
  'disabled:pointer-events-none disabled:opacity-50',
  '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4',
].join(' ');

// Segmented variant — h-8 list, h-7 trigger, Feishu card-on-rail look.
const SEGMENTED_CLASSES = [
  'inline-flex h-7 items-center justify-center gap-1.5 whitespace-nowrap',
  'rounded-md px-2 py-1 text-sm transition-[color,box-shadow]',
  'text-foreground dark:text-muted-foreground',
  'data-[state=active]:bg-card data-[state=active]:shadow-xs',
  'data-[state=active]:text-gray-900 data-[state=active]:font-medium',
  'dark:data-[state=active]:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30',
  'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring',
  'focus-visible:ring-[3px] focus-visible:outline-1',
  'disabled:pointer-events-none disabled:opacity-50',
  '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4',
].join(' ');
</script>

<template>
  <TabsTrigger
    v-bind="forwardedProps"
    :class="cn(variant === 'underline' ? UNDERLINE_CLASSES : SEGMENTED_CLASSES, props.class)"
  >
    <slot />
  </TabsTrigger>
</template>
