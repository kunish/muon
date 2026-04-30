<script setup lang="ts">
import type { ContextMenuItemEmits, ContextMenuItemProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { ContextMenuItem, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@/shared/lib/utils'

interface Props extends ContextMenuItemProps {
  class?: HTMLAttributes['class']
  inset?: boolean
}

const props = defineProps<Props>()
const emits = defineEmits<ContextMenuItemEmits>()
const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <ContextMenuItem
    v-bind="{ ...forwarded, class: undefined }"
    :class="cn(
      'workspace-menu-item',
      inset && 'pl-8',
      props.class,
    )"
  >
    <slot />
  </ContextMenuItem>
</template>
