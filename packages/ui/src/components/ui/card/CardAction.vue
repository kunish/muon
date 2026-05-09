<script setup lang="ts">
import { cn } from '../../../utils'

const props = defineProps<{
  class?: string
}>()
</script>

<template>
  <div
    data-slot="card-action"
    :class="cn('text-muted-foreground flex items-center self-start', props.class)"
  >
    <slot />
  </div>
</template>
