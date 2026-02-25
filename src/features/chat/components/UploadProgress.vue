<script setup lang="ts">
defineProps<{
  progress: number
  visible: boolean
}>()
</script>

<template>
  <div v-if="visible" class="px-4 py-1">
    <div class="h-1 bg-muted rounded-full overflow-hidden">
      <div
        class="h-full bg-primary rounded-full transition-all duration-300"
        :style="{ width: `${progress}%` }"
      />
    </div>
  </div>
</template>
