<script setup lang="ts">
import type { ContextMenuRootEmits, ContextMenuRootProps } from 'reka-ui'
import { ContextMenuRoot } from 'reka-ui'
import { computed, shallowRef } from 'vue'
import { useContextMenuScrollLock } from '../../../composables/useContextMenuScrollLock'

interface Props extends ContextMenuRootProps {
  open?: boolean
}

const props = defineProps<Props>()
const emits = defineEmits<ContextMenuRootEmits>()
const internalOpen = shallowRef(false)

const forwarded = computed<ContextMenuRootProps>(() => {
  const { open: _open, ...rootProps } = props
  return rootProps
})

const isOpen = computed(() => props.open ?? internalOpen.value)

function onOpenChange(open: boolean): void {
  internalOpen.value = open
  emits('update:open', open)
}

useContextMenuScrollLock(isOpen)
</script>

<template>
  <ContextMenuRoot v-bind="forwarded" @update:open="onOpenChange">
    <slot />
  </ContextMenuRoot>
</template>
