<script setup lang="ts">
import type { ScrollAreaScrollbarProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { ScrollAreaScrollbar, ScrollAreaThumb } from 'reka-ui'
import { cn } from '../../../utils'

interface Props extends ScrollAreaScrollbarProps {
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  orientation: 'vertical',
})
</script>

<template>
  <ScrollAreaScrollbar
    v-bind="{ ...props, class: undefined }"
    :class="cn(
      'muon-scrollbar-track flex touch-none select-none transition-colors',
      orientation === 'vertical' && 'h-full w-2.5 p-px',
      orientation === 'horizontal' && 'h-2.5 flex-col p-px',
      props.class,
    )"
  >
    <ScrollAreaThumb class="muon-scrollbar-thumb relative flex-1 rounded-full" />
  </ScrollAreaScrollbar>
</template>
