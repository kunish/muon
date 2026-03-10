<script setup lang="ts">
import { Progress } from '@/shared/components/ui/progress'

defineProps<{
  progress: number
  visible: boolean
}>()
</script>

<template>
  <div v-if="visible" class="px-4 py-1">
    <Progress :model-value="progress" class="h-1" />
  </div>
</template>
