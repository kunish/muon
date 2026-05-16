<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { ColorSwatchVariants } from '.'
import { colorSwatchVariants } from '.'
import { cn } from '../../utils'

const props = withDefaults(defineProps<{
  color: string
  selected?: boolean
  disabled?: boolean
  size?: ColorSwatchVariants['size']
  ariaLabel?: string
  class?: HTMLAttributes['class']
}>(), { size: 'md', selected: false, disabled: false })

const emits = defineEmits<{ select: [color: string] }>()
function onClick() {
  if (!props.disabled)
    emits('select', props.color)
}
</script>

<template>
  <button
    type="button"
    :aria-pressed="selected"
    :aria-label="ariaLabel ?? `Color ${color}`"
    :disabled="disabled"
    :class="cn(
      colorSwatchVariants({ size }),
      selected ? 'outline outline-2 outline-offset-2 outline-brand-500' : 'outline-none',
      disabled && 'cursor-not-allowed opacity-50',
      props.class,
    )"
    :style="{ backgroundColor: color }"
    :data-testid="$attrs['data-testid']"
    @click="onClick"
  />
</template>
