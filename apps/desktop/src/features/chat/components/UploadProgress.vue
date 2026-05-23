<script setup lang="ts">
import { Progress } from '@muon/ui/progress'

defineProps<{
  progress: number
  visible: boolean
}>()
</script>

<template>
  <Transition
    enter-active-class="overflow-hidden transition-all duration-300 ease-out"
    leave-active-class="overflow-hidden transition-all duration-200 ease-in"
    enter-from-class="max-h-0 opacity-0"
    enter-to-class="max-h-6 opacity-100"
    leave-from-class="max-h-6 opacity-100"
    leave-to-class="max-h-0 opacity-0"
  >
    <div v-if="visible" class="px-4 py-0.5">
      <Progress :model-value="progress" class="h-0.5" />
    </div>
  </Transition>
</template>
