<script setup lang="ts">
import { cn } from '../../../utils'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <div
    :class="
      cn(
        'bg-card text-card-foreground flex flex-col gap-6 rounded-lg border py-6 shadow-sm',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
