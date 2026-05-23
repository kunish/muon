<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { SegmentedControlVariants, SegmentItem } from '.'
import { useVModel } from '@vueuse/core'
import { segmentedControlVariants } from '.'
import { cn } from '../../utils'

const props = withDefaults(defineProps<{
  items: SegmentItem[]
  modelValue?: string
  defaultValue?: string
  variant?: SegmentedControlVariants['variant']
  size?: SegmentedControlVariants['size']
  class?: HTMLAttributes['class']
}>(), { variant: 'default', size: 'md' })

const emits = defineEmits<{ 'update:modelValue': [value: string] }>()
const value = useVModel(props, 'modelValue', emits, {
  passive: true,
  defaultValue: props.defaultValue ?? props.items[0]?.value,
})

function isActive(v: string) {
  return value.value === v
}

function activate(v: string) {
  value.value = v
}
</script>

<template>
  <div
    :class="cn(segmentedControlVariants({ variant, size }), props.class)"
    role="tablist"
    :data-testid="$attrs['data-testid']"
  >
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      role="tab"
      :aria-selected="isActive(item.value)"
      :data-active="isActive(item.value) || undefined"
      :class="cn(
        'inline-flex h-full items-center justify-center rounded-[5px] px-3 transition-colors',
        isActive(item.value)
          ? 'bg-card text-gray-900 font-medium shadow-xs'
          : 'text-gray-500 hover:text-gray-700',
      )"
      @click="activate(item.value)"
    >
      {{ item.label }}
    </button>
  </div>
</template>
