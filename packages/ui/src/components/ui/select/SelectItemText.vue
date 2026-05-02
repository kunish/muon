<script setup lang="ts">
import type { SelectItemTextProps } from 'reka-ui'
import { SelectItemText, useForwardProps } from 'reka-ui'

const props = defineProps<SelectItemTextProps>()
const forwardedProps = useForwardProps(props)
</script>

<template>
  <SelectItemText v-bind="forwardedProps">
    <slot />
  </SelectItemText>
</template>
