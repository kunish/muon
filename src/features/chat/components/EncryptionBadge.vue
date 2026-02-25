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
      class="text-green-500"
    />
    <ShieldAlert
      v-else
      :size="12"
      class="text-orange-500"
    />
  </span>
</template>
