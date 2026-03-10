<script setup lang="ts">
import type { SelectGroupProps } from 'reka-ui'
import { SelectGroup, useForwardProps } from 'reka-ui'

const props = defineProps<SelectGroupProps>()

const forwardedProps = useForwardProps(props)
</script>

<template>
  <SelectGroup v-bind="forwardedProps">
    <slot />
  </SelectGroup>
</template>
