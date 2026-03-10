<script setup lang="ts">
import { cn } from '@/shared/lib/utils'

const props = defineProps<{
  class?: string
}>()
</script>

<template>
  <div
    :class="cn('text-muted-foreground flex items-center self-start', props.class)"
  >
    <slot />
  </div>
</template>
