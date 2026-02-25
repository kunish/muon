<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { cn } from '@/shared/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()

const classes = computed(() => cn(
  'animate-pulse rounded-md bg-muted',
  props.class,
))
</script>

<template>
  <div :class="classes" />
</template>
