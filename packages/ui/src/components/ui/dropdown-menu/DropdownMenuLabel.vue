<script setup lang="ts">
import type { DropdownMenuLabelProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { DropdownMenuLabel } from 'reka-ui'
import { cn } from '../../../utils'

interface Props extends DropdownMenuLabelProps {
  class?: HTMLAttributes['class']
  inset?: boolean
}

const props = defineProps<Props>()
</script>

<template>
  <DropdownMenuLabel :class="cn('px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-500', inset && 'pl-8', props.class)">
    <slot />
  </DropdownMenuLabel>
</template>
