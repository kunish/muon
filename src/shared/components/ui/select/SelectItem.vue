<script setup lang="ts">
import type { SelectItemProps } from 'reka-ui'
import { CheckIcon } from 'lucide-vue-next'
import { SelectItem, SelectItemIndicator, useForwardProps } from 'reka-ui'
import { cn } from '@/shared/lib/utils'

const props = defineProps<SelectItemProps & { class?: string }>()

const forwardedProps = useForwardProps(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <SelectItem
    v-bind="forwardedProps"
    :class="
      cn(
        'focus:bg-accent focus:text-accent-foreground [&>span]:flex [&>span]:items-center [&>span]:gap-2 relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2',
        props.class,
      )
    "
  >
    <span class="absolute right-2 flex size-3.5 items-center justify-center">
      <SelectItemIndicator>
        <CheckIcon class="size-4" />
      </SelectItemIndicator>
    </span>
    <slot />
  </SelectItem>
</template>
