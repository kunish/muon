<script setup lang="ts">
import { Lock, ShieldAlert } from 'lucide-vue-next'

defineProps<{
  encrypted: boolean
  verified?: boolean
}>()
</script>

<template>
  <span v-if="encrypted" class="inline-flex items-center">
    <Lock
      v-if="verified !== false"
      :size="12"
      class="text-success"
    />
    <ShieldAlert
      v-else
      :size="12"
      class="text-warning"
    />
  </span>
</template>
