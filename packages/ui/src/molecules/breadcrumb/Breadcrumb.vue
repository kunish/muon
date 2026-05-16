<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { BreadcrumbItem, BreadcrumbVariants } from '.'
import { ChevronRight } from 'lucide-vue-next'
import { computed } from 'vue'
import { breadcrumbVariants } from '.'
import { cn } from '../../utils'

const props = withDefaults(defineProps<{
  items: BreadcrumbItem[]
  size?: BreadcrumbVariants['size']
  truncation?: 'middle' | 'end'
  maxSegmentWidth?: number
  class?: HTMLAttributes['class']
}>(), {
  size: 'md',
  truncation: 'middle',
  maxSegmentWidth: 200,
})

const visible = computed(() => {
  if (props.items.length <= 4)
    return props.items
  if (props.truncation === 'end')
    return props.items.slice(0, 4).concat([{ label: '…' }])
  return [props.items[0], { label: '…' }, ...props.items.slice(-2)]
})
</script>

<template>
  <nav :class="cn(breadcrumbVariants({ size }), props.class)" aria-label="Breadcrumb">
    <template v-for="(item, i) in visible" :key="i">
      <ChevronRight v-if="i > 0" class="size-3 shrink-0 text-gray-300" aria-hidden="true" />
      <span
        v-if="i === visible.length - 1 || !item.href"
        :class="i === visible.length - 1 ? 'font-medium text-breadcrumb-current-fg' : 'text-gray-500'"
        :style="{ maxWidth: `${maxSegmentWidth}px` }"
        class="truncate"
        :aria-current="i === visible.length - 1 ? 'page' : undefined"
      >{{ item.label }}</span>
      <a
        v-else
        :href="item.href"
        class="truncate text-gray-500 underline-offset-4 hover:underline"
        :style="{ maxWidth: `${maxSegmentWidth}px` }"
      >{{ item.label }}</a>
    </template>
  </nav>
</template>

<style scoped>
.text-breadcrumb-current-fg {
  color: var(--color-breadcrumb-current-fg);
}
</style>
